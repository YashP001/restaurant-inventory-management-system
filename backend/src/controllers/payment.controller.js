import { PaymentService } from '../services/payment.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const PaymentController = {
  /**
   * @route   GET /api/v1/orders/:id/payments
   * @desc    List all payments recorded for an order with settlement summary
   * @access  Private (Authenticated Staff)
   */
  async getPaymentsByOrderId(req, res, next) {
    try {
      const { id } = req.params;
      const result = await PaymentService.getPaymentsByOrderId(id);
      return ApiResponse.ok(res, result, 'Order payments retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/payments
   * @desc    Record a payment against a customer order
   * @access  Private (ADMIN, CASHIER)
   */
  async recordPayment(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await PaymentService.recordPayment(id, req.body, req.user, req.id);
      return ApiResponse.created(res, payment, 'Payment recorded successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default PaymentController;
