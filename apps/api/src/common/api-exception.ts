import { HttpException } from '@nestjs/common';
import type { ApiErrorCode, ApiErrorResponse } from '@expression/shared';

/** message 必须为面向用户的说明，不传入上游原始错误。 */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode, message: string) {
    super({ code, message } satisfies ApiErrorResponse, status);
  }
}
