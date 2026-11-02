import { PaymentModel } from '../models/sql/payment.model.js';
import { OrderModel } from '../models/sql/order.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { getMySQLPool } from '../config/mysql.js';

export const PaymentService = {
  /**
   * Retrieves all payments recorded for an order with settlement summary
   */
  async getPaymentsByOrderId(orderId) {
    const order = await OrderModel.findOrderById(orderId);
    if (!order) {
      throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
    }

    const payments = await PaymentModel.findPaymentsByOrderId(order.id);
    const totalPaid = payments
      .filter(p => p.payment_status === 'SUCCESSFUL')
      .reduce((sum, p) => sum + p.amount_paid, 0);

    const outstandingBalance = Math.max(0, Number((order.total_amount - totalPaid).toFixed(2)));

    return {
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.status,
      total_amount: order.total_amount,
      total_paid: Number(totalPaid.toFixed(2)),
      outstanding_balance: outstandingBalance,
      is_fully_paid: totalPaid >= order.total_amount && order.total_amount > 0,
      payments
    };
  },

  /**
   * Records a payment against a customer order
   * Executes within a dedicated MySQL InnoDB transaction with row locks to prevent overpayment race conditions
   */
  async recordPayment(orderId, paymentData, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock order
      const order = await OrderModel.findOrderWithLock(orderId, connection);
      if (!order) {
        throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
      }

      // 2. Prevent payments against cancelled orders
      if (order.status === 'CANCELLED') {
        throw ApiError.badRequest(
          `Cannot record payment for order '${order.order_number}' because it is CANCELLED`,
          'ORDER_CANCELLED'
        );
      }

      // 3. Calculate settled balance under lock
      const totalPaidAlready = await PaymentModel.getTotalPaidWithLock(order.id, connection);
      const outstandingBalance = Math.max(0, Number((order.total_amount - totalPaidAlready).toFixed(2)));

      if (outstandingBalance <= 0) {
        throw ApiError.badRequest(
          `Order '${order.order_number}' is already fully paid. Total: ₹${order.total_amount}, Paid: ₹${totalPaidAlready}`,
          'ORDER_ALREADY_FULLY_PAID'
        );
      }

      // 4. Overpayment check
      if (paymentData.amount_paid > outstandingBalance + 0.001) {
        throw ApiError.badRequest(
          `Payment amount (₹${paymentData.amount_paid}) exceeds outstanding order balance (₹${outstandingBalance})`,
          'OVERPAYMENT_NOT_ALLOWED'
        );
      }

      // 5. Generate unique transaction reference if omitted
      const txnRef = paymentData.transaction_reference || `TXN-UB-${String(order.id).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;

      // 6. Insert payment record (strictly omitting sensitive card credentials)
      const paymentId = await PaymentModel.createPayment({
        order_id: order.id,
        payment_method: paymentData.payment_method,
        amount_paid: paymentData.amount_paid,
        transaction_reference: txnRef,
        payment_status: 'SUCCESSFUL'
      }, connection);

      await connection.commit();

      const newTotalPaid = Number((totalPaidAlready + paymentData.amount_paid).toFixed(2));
      const remainingBalance = Math.max(0, Number((order.total_amount - newTotalPaid).toFixed(2)));

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PAYMENT_RECORDED',
        resourceType: 'PAYMENT',
        resourceId: String(paymentId),
        requestId,
        metadata: {
          paymentId,
          orderId: order.id,
          orderNumber: order.order_number,
          paymentMethod: paymentData.payment_method,
          amountPaid: paymentData.amount_paid,
          transactionReference: txnRef,
          totalAmount: order.total_amount,
          newTotalPaid,
          remainingBalance
        }
      });

      return {
        payment_id: paymentId,
        order_id: order.id,
        order_number: order.order_number,
        payment_method: paymentData.payment_method,
        amount_paid: paymentData.amount_paid,
        transaction_reference: txnRef,
        payment_status: 'SUCCESSFUL',
        order_total: order.total_amount,
        total_paid: newTotalPaid,
        remaining_balance: remainingBalance,
        is_fully_paid: newTotalPaid >= order.total_amount
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

export default PaymentService;
