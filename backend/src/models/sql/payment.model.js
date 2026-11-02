import { getMySQLPool } from '../../config/mysql.js';

/**
 * Payment Data Access Object (DAO)
 * Manages customer order settlements, multi-payment transactions, and outstanding balance reconciliation
 * Backed by MySQL `payments` table
 */
export const PaymentModel = {
  /**
   * Retrieves all payments recorded for an order
   */
  async findPaymentsByOrderId(orderId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        p.id,
        p.order_id,
        p.payment_method,
        CAST(p.amount_paid AS DECIMAL(10, 2)) AS amount_paid,
        p.transaction_reference,
        p.payment_status,
        p.paid_at
      FROM \`payments\` p
      WHERE p.order_id = ?
      ORDER BY p.paid_at ASC, p.id ASC;
    `;
    const [rows] = await executor.query(sql, [orderId]);
    return rows.map(r => ({
      id: r.id,
      order_id: r.order_id,
      payment_method: r.payment_method,
      amount_paid: Number(r.amount_paid),
      transaction_reference: r.transaction_reference,
      payment_status: r.payment_status,
      paid_at: r.paid_at
    }));
  },

  /**
   * Retrieves total settled payments for an order under row lock
   */
  async getTotalPaidWithLock(orderId, connection) {
    const sql = `
      SELECT CAST(COALESCE(SUM(amount_paid), 0.00) AS DECIMAL(10, 2)) AS total_paid
      FROM \`payments\`
      WHERE order_id = ? AND payment_status = 'SUCCESSFUL'
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [orderId]);
    return Number(rows[0]?.total_paid || 0);
  },

  /**
   * Inserts payment record
   */
  async createPayment({
    order_id,
    payment_method,
    amount_paid,
    transaction_reference = null,
    payment_status = 'SUCCESSFUL'
  }, connection) {
    const sql = `
      INSERT INTO \`payments\` (
        order_id,
        payment_method,
        amount_paid,
        transaction_reference,
        payment_status
      ) VALUES (?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(sql, [
      order_id,
      payment_method,
      amount_paid,
      transaction_reference,
      payment_status
    ]);
    return result.insertId;
  },

  /**
   * Retrieves payment by ID
   */
  async findPaymentById(id, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        p.id,
        p.order_id,
        o.order_number,
        p.payment_method,
        CAST(p.amount_paid AS DECIMAL(10, 2)) AS amount_paid,
        p.transaction_reference,
        p.payment_status,
        p.paid_at
      FROM \`payments\` p
      JOIN \`orders\` o ON p.order_id = o.id
      WHERE p.id = ?
      LIMIT 1;
    `;
    const [rows] = await executor.query(sql, [id]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      order_id: r.order_id,
      order_number: r.order_number,
      payment_method: r.payment_method,
      amount_paid: Number(r.amount_paid),
      transaction_reference: r.transaction_reference,
      payment_status: r.payment_status,
      paid_at: r.paid_at
    };
  }
};

export default PaymentModel;
