import { ReceiptService } from '../services/receipt.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const ReceiptController = {
  /**
   * @route   POST /api/v1/inventory/receipts
   * @desc    Receive inventory stock against a purchase order (atomic transaction)
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async receiveStock(req, res, next) {
    try {
      const receiptData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const receipt = await ReceiptService.processStockReceipt(receiptData, actingUser, requestId);
      return ApiResponse.created(res, receipt, 'Inventory batches received and stock movements recorded successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/receipts
   * @desc    List stock receipt records grouped by purchase order
   * @access  Private (Authenticated Staff)
   */
  async getReceipts(req, res, next) {
    try {
      const { supplier_id, purchase_order_id, start_date, end_date, page, limit } = req.query;
      const result = await ReceiptService.getReceipts({
        supplierId: supplier_id,
        purchaseOrderId: purchase_order_id,
        startDate: start_date,
        endDate: end_date,
        page,
        limit
      });

      return ApiResponse.ok(res, result.receipts, 'Stock receipts retrieved successfully', {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/receipts/:id
   * @desc    Get detailed stock receipt breakdown for a purchase order
   * @access  Private (Authenticated Staff)
   */
  async getReceiptById(req, res, next) {
    try {
      const { id } = req.params;
      const receipt = await ReceiptService.getReceiptById(id);
      return ApiResponse.ok(res, receipt, 'Stock receipt details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default ReceiptController;
