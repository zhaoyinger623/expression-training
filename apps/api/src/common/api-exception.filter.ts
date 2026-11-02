import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiErrorResponse } from '@expression/shared';
import { ApiException } from './api-exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    let body: ApiErrorResponse;

    if (exception instanceof ApiException) {
      body = exception.getResponse() as ApiErrorResponse;
    } else if (status === 404) {
      body = { code: 'NOT_FOUND', message: '请求的接口不存在' };
    } else if (status === 400) {
      body = { code: 'INVALID_REQUEST', message: '请求格式不正确' };
    } else if (status === 413) {
      body = { code: 'AUDIO_TOO_LARGE', message: '录音文件不能超过 4 MiB' };
    } else {
      body = status >= 500
        ? { code: 'INTERNAL_ERROR', message: '服务暂时无法完成请求，请稍后重试' }
        : { code: 'HTTP_ERROR', message: '请求无法处理' };
    }
    response.status(status).json(body);
  }
}
