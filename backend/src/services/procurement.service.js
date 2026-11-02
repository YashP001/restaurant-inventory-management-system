import { ForecastModel } from '../models/sql/forecast.model.js';
import { PurchaseOrderModel } from '../models/sql/purchaseOrder.model.js';
import { SupplierModel } from '../models/sql/supplier.model.js';
import { ForecastingService } from './forecasting.service.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { getMySQLPool } from '../config/mysql.js';

export const ProcurementService = {
  /**
   * Generates intelligent procurement recommendations based on:
   * 1. 7-day ingredient forecast demand (via BOM expansion).
   * 2. FEFO inventory batch usable stock & expiry simulation.
   * 3. Incoming eligible purchase orders (SUBMITTED, PARTIALLY_RECEIVED).
   * 4. Supplier lead times, MOQ, preferred supplier catalog, and contractual costs.
   */
  async generateProcurementRecommendations({ horizonDays = 7 } = {}) {
    // 1. Get ingredient demand from latest menu forecasts
    const demandResult = await ForecastingService.getIngredientDemand();
    const { dailyIngredientDemand, aggregatedIngredientDemand } = demandResult;

    // 2. Fetch active inventory batches
    const activeBatches = await ForecastModel.getActiveBatches();

    // 3. Fetch incoming purchase orders
    const incomingPOs = await ForecastModel.getIncomingPurchaseOrders();

    // 4. Fetch ingredients master catalog with supplier information
    const ingredientsCatalog = await ForecastModel.getIngredientsWithSupplierCatalog();

    // Determine forecast calendar dates
    let forecastDates = Array.from(new Set(dailyIngredientDemand.map(d => d.date))).sort();
    if (forecastDates.length === 0) {
      // Fallback: Generate 7 dates starting tomorrow if no forecasts present
      const today = new Date();
      forecastDates = [];
      for (let i = 1; i <= horizonDays; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        forecastDates.push(d.toISOString().split('T')[0]);
      }
    }

    // Build batch map by ingredient_id
    const batchesByIngredient = new Map();
    for (const b of activeBatches) {
      if (!batchesByIngredient.has(b.ingredient_id)) {
        batchesByIngredient.set(b.ingredient_id, []);
      }
      batchesByIngredient.get(b.ingredient_id).push({ ...b });
    }

    // Build incoming PO map by ingredient_id
    const incomingByIngredient = new Map();
    for (const po of incomingPOs) {
      if (!incomingByIngredient.has(po.ingredient_id)) {
        incomingByIngredient.set(po.ingredient_id, []);
      }
      incomingByIngredient.get(po.ingredient_id).push(po);
    }

    // Build demand map: ingredient_id -> date -> quantity
    const demandByIngredientDate = new Map();
    const totalDemandByIngredient = new Map();
    for (const d of dailyIngredientDemand) {
      if (!demandByIngredientDate.has(d.ingredient_id)) {
        demandByIngredientDate.set(d.ingredient_id, new Map());
      }
      demandByIngredientDate.get(d.ingredient_id).set(d.date, d.required_quantity);
    }
    for (const a of aggregatedIngredientDemand) {
      totalDemandByIngredient.set(a.ingredient_id, a.total_required_quantity);
    }

    const recommendations = [];

    // Analyze each ingredient
    for (const ing of ingredientsCatalog) {
      const ingredientId = ing.ingredient_id;
      const ingBatches = batchesByIngredient.get(ingredientId) || [];
      const ingInbound = incomingByIngredient.get(ingredientId) || [];
      const dateDemandMap = demandByIngredientDate.get(ingredientId) || new Map();
      const totalDemand = totalDemandByIngredient.get(ingredientId) || 0.0;

      // Current usable stock (batches with remaining > 0 and expiry_date >= first forecast date)
      const firstDate = forecastDates[0];
      const initialUsableStock = ingBatches
        .filter(b => b.expiry_date >= firstDate)
        .reduce((sum, b) => sum + b.quantity_remaining, 0.0);

      // Day-by-day forward simulation over forecast dates
      let runningBatches = ingBatches.map(b => ({ ...b }));
      const dailyAnalysis = [];
      let totalExpiringDuringForecast = 0.0;
      let totalInboundDuringForecast = 0.0;

      for (const targetDate of forecastDates) {
        // Inbound deliveries scheduled on or before this target date (that haven't been accounted yet)
        const dayInbound = ingInbound
          .filter(po => po.expected_delivery_date === targetDate)
          .reduce((sum, po) => sum + po.outstanding_quantity, 0.0);
        totalInboundDuringForecast += dayInbound;

        // Opening usable stock on this day (batches not expired yet)
        const openingStock = runningBatches
          .filter(b => b.expiry_date >= targetDate)
          .reduce((sum, b) => sum + b.quantity_remaining, 0.0);

        // Batches expiring on this specific day
        const expiringToday = runningBatches
          .filter(b => b.expiry_date === targetDate)
          .reduce((sum, b) => sum + b.quantity_remaining, 0.0);
        totalExpiringDuringForecast += expiringToday;

        const dayDemand = dateDemandMap.get(targetDate) || 0.0;

        // Deduct dayDemand using FEFO from eligible batches
        let demandRemaining = dayDemand;
        for (const b of runningBatches) {
          if (b.expiry_date >= targetDate && b.quantity_remaining > 0) {
            const deduction = Math.min(b.quantity_remaining, demandRemaining);
            b.quantity_remaining -= deduction;
            demandRemaining -= deduction;
            if (demandRemaining <= 0) break;
          }
        }

        // Add inbound delivery to usable stock as a synthetic batch arriving today with default long shelf-life
        if (dayInbound > 0) {
          runningBatches.push({
            id: `inbound-${targetDate}`,
            ingredient_id: ingredientId,
            batch_number: `INBOUND-PO-${targetDate}`,
            quantity_received: dayInbound,
            quantity_remaining: dayInbound,
            expiry_date: '2099-12-31' // Inbound stock fresh
          });
        }

        const closingStock = runningBatches
          .filter(b => b.expiry_date >= targetDate)
          .reduce((sum, b) => sum + b.quantity_remaining, 0.0);

        dailyAnalysis.push({
          date: targetDate,
          opening_usable_stock: Number(openingStock.toFixed(3)),
          forecast_demand: Number(dayDemand.toFixed(3)),
          expiring_stock: Number(expiringToday.toFixed(3)),
          incoming_po_quantity: Number(dayInbound.toFixed(3)),
          closing_projected_stock: Number(closingStock.toFixed(3))
        });
      }

      // Closing projected stock at end of 7-day horizon
      const closingStockHorizon = dailyAnalysis[dailyAnalysis.length - 1]?.closing_projected_stock || 0.0;

      // Total outstanding incoming across all dates
      const totalOutstandingPOQuantity = ingInbound.reduce((sum, po) => sum + po.outstanding_quantity, 0.0);

      // Supplier selection
      // Prioritize preferred supplier, then lowest contract unit cost
      let selectedSupplier = ing.suppliers.find(s => s.is_preferred_supplier) || ing.suppliers[0] || null;

      const hasValidSupplier = Boolean(selectedSupplier);
      const leadTimeDays = selectedSupplier ? selectedSupplier.lead_time_days : 1;
      const moq = selectedSupplier ? selectedSupplier.minimum_order_quantity : 1.0;
      const contractUnitCost = selectedSupplier ? selectedSupplier.contract_unit_cost : ing.cost_per_unit;

      const leadTimeExceedsHorizon = leadTimeDays > forecastDates.length;

      // Calculate Lead-Time Demand
      let leadTimeDemand = 0.0;
      const leadTimeDates = forecastDates.slice(0, leadTimeDays);
      for (const d of leadTimeDates) {
        leadTimeDemand += (dateDemandMap.get(d) || 0.0);
      }

      // Extrapolate if lead time exceeds 7-day horizon
      if (leadTimeExceedsHorizon) {
        const avgDailyDemand = totalDemand / forecastDates.length;
        const extraDays = leadTimeDays - forecastDates.length;
        leadTimeDemand += (extraDays * avgDailyDemand);
      }

      // Safety Stock & Reorder Point
      // Documented as initial safety buffer per requirements
      const safetyStock = ing.minimum_stock_level;
      const reorderPoint = leadTimeDemand + safetyStock;

      // Available stock covering lead time:
      // Usable stock that won't expire before lead time ends + Inbound POs arriving within lead time
      const leadTimeEndDate = forecastDates[Math.min(leadTimeDays - 1, forecastDates.length - 1)];
      const stockUsableForLeadTime = ingBatches
        .filter(b => b.expiry_date >= leadTimeEndDate)
        .reduce((sum, b) => sum + b.quantity_remaining, 0.0);
      
      const inboundDuringLeadTime = ingInbound
        .filter(po => po.expected_delivery_date <= leadTimeEndDate)
        .reduce((sum, po) => sum + po.outstanding_quantity, 0.0);

      const projectedStockAtLeadTime = stockUsableForLeadTime + inboundDuringLeadTime - leadTimeDemand;

      // Shortage calculation
      // If projected stock is below Reorder Point or below optimal_par_level
      const isShortage = projectedStockAtLeadTime < reorderPoint;
      let rawOrderQuantity = 0.0;
      let recommendedQuantity = 0.0;
      let estimatedCost = 0.0;

      if (isShortage) {
        // Target reaching optimal par level (or reorder point if par level is lower)
        const targetLevel = Math.max(ing.optimal_par_level, reorderPoint);
        rawOrderQuantity = Math.max(0.0, targetLevel - projectedStockAtLeadTime);

        // Apply Minimum Order Quantity (MOQ)
        recommendedQuantity = Math.max(rawOrderQuantity, moq);
        estimatedCost = recommendedQuantity * contractUnitCost;
      }

      // Build warnings and limitations
      const warnings = [];
      if (!hasValidSupplier) {
        warnings.push('No active supplier configured for ingredient. Action required: assign supplier in catalog.');
      }
      if (leadTimeExceedsHorizon) {
        warnings.push(`Supplier lead time (${leadTimeDays} days) exceeds ${forecastDates.length}-day forecast horizon. Lead-time demand includes daily average extrapolation.`);
      }
      if (totalExpiringDuringForecast > 0) {
        warnings.push(`${Number(totalExpiringDuringForecast.toFixed(3))} ${ing.unit_abbr} of inventory will expire during the forecast window.`);
      }

      recommendations.push({
        ingredient_id: ingredientId,
        ingredient_name: ing.ingredient_name,
        unit_id: ing.unit_id,
        unit_name: ing.unit_name,
        unit_abbr: ing.unit_abbr,
        current_usable_stock: Number(initialUsableStock.toFixed(3)),
        minimum_stock_level: ing.minimum_stock_level,
        optimal_par_level: ing.optimal_par_level,
        total_forecast_demand_7d: Number(totalDemand.toFixed(3)),
        total_expiring_stock_7d: Number(totalExpiringDuringForecast.toFixed(3)),
        total_inbound_po_quantity: Number(totalOutstandingPOQuantity.toFixed(3)),
        closing_projected_stock_7d: Number(closingStockHorizon.toFixed(3)),
        lead_time_days: leadTimeDays,
        lead_time_demand: Number(leadTimeDemand.toFixed(3)),
        safety_stock: Number(safetyStock.toFixed(3)),
        reorder_point: Number(reorderPoint.toFixed(3)),
        projected_stock_at_lead_time: Number(projectedStockAtLeadTime.toFixed(3)),
        reorder_needed: isShortage && hasValidSupplier,
        raw_order_quantity: Number(rawOrderQuantity.toFixed(3)),
        minimum_order_quantity: Number(moq.toFixed(3)),
        recommended_order_quantity: Number(recommendedQuantity.toFixed(3)),
        estimated_cost: Number(estimatedCost.toFixed(2)),
        supplier: selectedSupplier ? {
          supplier_id: selectedSupplier.supplier_id,
          supplier_name: selectedSupplier.supplier_name,
          lead_time_days: selectedSupplier.lead_time_days,
          contract_unit_cost: selectedSupplier.contract_unit_cost,
          minimum_order_quantity: selectedSupplier.minimum_order_quantity,
          is_preferred: selectedSupplier.is_preferred_supplier
        } : null,
        warnings,
        daily_analysis: dailyAnalysis
      });
    }

    return {
      forecast_horizon_days: forecastDates.length,
      forecast_start_date: forecastDates[0],
      forecast_end_date: forecastDates[forecastDates.length - 1],
      total_ingredients_evaluated: recommendations.length,
      reorder_required_count: recommendations.filter(r => r.reorder_needed).length,
      total_estimated_procurement_cost: Number(
        recommendations.reduce((sum, r) => sum + r.estimated_cost, 0.0).toFixed(2)
      ),
      recommendations
    };
  },

  /**
   * Converts selected procurement recommendations into DRAFT purchase orders.
   * Groups items by supplier_id so each distinct supplier gets a separate PO.
   * Executes in an atomic MySQL InnoDB transaction.
   * Never automatically submits purchase orders.
   */
  async convertRecommendationsToPO({ items, notes = null, actingUser, requestId = null }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('At least one recommendation item must be provided for PO conversion', 'EMPTY_PO_ITEMS');
    }

    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Group items by supplier_id
      const supplierGroups = new Map();

      for (const item of items) {
        const supplierId = Number(item.supplier_id);
        const ingredientId = Number(item.ingredient_id);
        const quantity = Number(item.quantity);
        const unitCost = Number(item.unit_cost);

        if (!supplierId || isNaN(supplierId)) {
          throw ApiError.badRequest(`Missing or invalid supplier_id for ingredient ${ingredientId}`, 'INVALID_SUPPLIER_ID');
        }
        if (!ingredientId || isNaN(ingredientId)) {
          throw ApiError.badRequest('Missing or invalid ingredient_id', 'INVALID_INGREDIENT_ID');
        }
        if (!quantity || quantity <= 0) {
          throw ApiError.badRequest(`Purchase quantity for ingredient ${ingredientId} must be strictly positive`, 'INVALID_PURCHASE_QUANTITY');
        }

        // Validate supplier exists and active
        const supplier = await SupplierModel.findById(supplierId, connection);
        if (!supplier) {
          throw ApiError.notFound(`Supplier with ID ${supplierId} not found`, 'SUPPLIER_NOT_FOUND');
        }
        if (!supplier.is_active) {
          throw ApiError.badRequest(`Cannot create purchase order for inactive supplier '${supplier.name}'`, 'SUPPLIER_INACTIVE');
        }

        // Validate ingredient exists and get MOQ
        const [ingRows] = await connection.query(
          `SELECT i.id, i.name, si.minimum_order_quantity, si.contract_unit_cost
           FROM \`ingredients\` i
           LEFT JOIN \`supplier_ingredients\` si ON i.id = si.ingredient_id AND si.supplier_id = ?
           WHERE i.id = ?;`,
          [supplierId, ingredientId]
        );

        if (ingRows.length === 0) {
          throw ApiError.notFound(`Ingredient ID ${ingredientId} not found`, 'INGREDIENT_NOT_FOUND');
        }

        const ingMeta = ingRows[0];
        const moq = Number(ingMeta.minimum_order_quantity || 1.0);
        if (quantity < moq) {
          throw ApiError.badRequest(
            `Quantity ${quantity} for ingredient '${ingMeta.name}' is below supplier MOQ (${moq})`,
            'BELOW_MINIMUM_ORDER_QUANTITY'
          );
        }

        const effectiveUnitCost = unitCost > 0 ? unitCost : Number(ingMeta.contract_unit_cost || 0.0);

        if (!supplierGroups.has(supplierId)) {
          supplierGroups.set(supplierId, {
            supplier,
            items: []
          });
        }

        // Prevent duplicate ingredient lines within same PO
        const existingInGroup = supplierGroups.get(supplierId).items.find(i => i.ingredient_id === ingredientId);
        if (existingInGroup) {
          throw ApiError.badRequest(
            `Duplicate ingredient ID ${ingredientId} specified for supplier '${supplier.name}'`,
            'DUPLICATE_PO_ITEM'
          );
        }

        supplierGroups.get(supplierId).items.push({
          ingredient_id: ingredientId,
          ingredient_name: ingMeta.name,
          quantity_ordered: quantity,
          unit_cost: effectiveUnitCost,
          subtotal: Number((quantity * effectiveUnitCost).toFixed(2))
        });
      }

      const createdPurchaseOrders = [];
      const today = new Date().toISOString().split('T')[0];
      const year = today.split('-')[0];

      // Create a DRAFT PO for each supplier group
      for (const [supplierId, group] of supplierGroups.entries()) {
        const poNumber = await PurchaseOrderModel.getNextPONumber(year, connection);
        const leadTimeDays = group.supplier.lead_time_days || 1;
        
        const expectedDelivery = new Date();
        expectedDelivery.setDate(expectedDelivery.getDate() + leadTimeDays);
        const expectedDeliveryDate = expectedDelivery.toISOString().split('T')[0];

        const totalAmount = Number(
          group.items.reduce((sum, item) => sum + item.subtotal, 0.0).toFixed(2)
        );

        const poId = await PurchaseOrderModel.createPurchaseOrder({
          po_number: poNumber,
          supplier_id: supplierId,
          created_by_user_id: actingUser.id,
          status: 'DRAFT',
          total_amount: totalAmount,
          order_date: today,
          expected_delivery_date: expectedDeliveryDate,
          notes: notes || 'Automated draft created from intelligent procurement recommendation'
        }, connection);

        // Insert items
        const insertedItems = [];
        for (const item of group.items) {
          const itemId = await PurchaseOrderModel.createPurchaseOrderItem({
            purchase_order_id: poId,
            ingredient_id: item.ingredient_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0.0,
            unit_cost: item.unit_cost,
            subtotal: item.subtotal
          }, connection);

          insertedItems.push({
            id: itemId,
            ingredient_id: item.ingredient_id,
            ingredient_name: item.ingredient_name,
            quantity_ordered: item.quantity_ordered,
            unit_cost: item.unit_cost,
            subtotal: item.subtotal
          });
        }

        createdPurchaseOrders.push({
          id: poId,
          po_number: poNumber,
          supplier_id: supplierId,
          supplier_name: group.supplier.name,
          status: 'DRAFT',
          total_amount: totalAmount,
          order_date: today,
          expected_delivery_date: expectedDeliveryDate,
          items_count: insertedItems.length,
          items: insertedItems
        });

        // Audit log per created PO
        AuditLog.record({
          userId: actingUser.id,
          username: actingUser.username,
          action: 'PURCHASE_ORDER_CONVERTED_FROM_RECOMMENDATION',
          resourceType: 'PURCHASE_ORDER',
          resourceId: poNumber,
          metadata: {
            poId,
            poNumber,
            supplierId,
            totalAmount,
            itemsCount: insertedItems.length
          },
          requestId
        }).catch(e => console.error('[AuditLog] PO conversion log error:', e.message));
      }

      await connection.commit();

      return {
        status: 'success',
        message: `Successfully created ${createdPurchaseOrders.length} draft purchase order(s)`,
        purchase_orders: createdPurchaseOrders
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};
