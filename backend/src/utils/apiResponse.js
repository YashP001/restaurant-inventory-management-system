/**
 * Standardized API Response Structure
 * Guarantees uniform payload contract across all endpoints:
 * {
 *   "success": true,
 *   "statusCode": 200,
 *   "message": "Success",
 *   "data": {},
 *   "meta": null
 * }
 */
export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code (200, 201, etc.)
   * @param {any} data - Response payload (object, array, primitive)
   * @param {string} [message='Success'] - Human-readable success message
   * @param {object|null} [meta=null] - Optional pagination or metadata
   */
  constructor(statusCode = 200, data = {}, message = 'Success', meta = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data ?? {};
    this.meta = meta ?? null;
  }

  /**
   * Directly sends the JSON response via Express res object
   * @param {import('express').Response} res
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      meta: this.meta
    });
  }

  // Convenience Factory Methods
  static ok(res, data = {}, message = 'Success', meta = null) {
    return new ApiResponse(200, data, message, meta).send(res);
  }

  static created(res, data = {}, message = 'Resource created successfully', meta = null) {
    return new ApiResponse(201, data, message, meta).send(res);
  }

  static noContent(res, message = 'Resource deleted successfully') {
    return res.status(204).json(new ApiResponse(204, {}, message, null));
  }
}

export default ApiResponse;
