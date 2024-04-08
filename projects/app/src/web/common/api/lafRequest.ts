import axios, {
  Method,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosProgressEvent
} from 'axios';
import { useUserStore } from '@/web/support/user/useUserStore';

interface ConfigType {
  headers?: { [key: string]: string };
  timeout?: number;
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
  cancelToken?: AbortController;
  maxQuantity?: number;
}
interface ResponseDataType {
  error: string | null;
  data: any;
}

const maxQuantityMap: Record<
  string,
  {
    amount: number;
    sign: AbortController;
  }
> = {};

function requestStart({ url, maxQuantity }: { url: string; maxQuantity?: number }) {
  if (!maxQuantity) return;
  const item = maxQuantityMap[url];

  if (item) {
    if (item.amount >= maxQuantity && item.sign) {
      item.sign.abort();
      delete maxQuantityMap[url];
    }
  } else {
    maxQuantityMap[url] = {
      amount: 1,
      sign: new AbortController()
    };
  }
}
function requestFinish({ url }: { url: string }) {
  const item = maxQuantityMap[url];
  if (item) {
    item.amount--;
    if (item.amount <= 0) {
      delete maxQuantityMap[url];
    }
  }
}

/**
 * 请求开始
 */
function startInterceptors(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${useUserStore.getState().userInfo?.team?.lafAccount?.token || ''}`;
  }

  return config;
}

/**
 * 请求成功,检查请求头
 */
function responseSuccess(response: AxiosResponse<ResponseDataType>) {
  return response;
}
/**
 * 响应数据检查
 */
function checkRes(data: ResponseDataType) {
  if (data === undefined) {
    console.log('error->', data, 'data is empty');
    return Promise.reject('服务器异常');
  } else if (data.error) {
    return responseError(data.error);
  }

  return data.data;
}

/**
 * 响应错误
 */
function responseError(err: any) {
  console.log('error->', '请求错误', err);

  if (!err) {
    return Promise.reject({ message: '未知错误' });
  }
  if (typeof err === 'string') {
    return Promise.reject({ message: err });
  }

  if (err?.response?.data) {
    return Promise.reject(err?.response?.data);
  }
  return Promise.reject(err);
}

/* 创建请求实例 */
const instance = axios.create({
  timeout: 60000, // 超时时间
  headers: {
    'content-type': 'application/json'
  }
});

/* 请求拦截 */
instance.interceptors.request.use(startInterceptors, (err) => Promise.reject(err));
/* 响应拦截 */
instance.interceptors.response.use(responseSuccess, (err) => Promise.reject(err));

function request(
  url: string,
  data: any,
  { cancelToken, maxQuantity, ...config }: ConfigType,
  method: Method
): any {
  /* 去空 */
  for (const key in data) {
    if (data[key] === null || data[key] === undefined) {
      delete data[key];
    }
  }

  requestStart({ url, maxQuantity });

  return instance
    .request({
      baseURL: '/api/lafApi',
      url,
      method,
      data: ['POST', 'PUT'].includes(method) ? data : null,
      params: !['POST', 'PUT'].includes(method) ? data : null,
      signal: cancelToken?.signal,
      ...config // 用户自定义配置，可以覆盖前面的配置
    })
    .then((res) => checkRes(res.data))
    .catch((err) => responseError(err))
    .finally(() => requestFinish({ url }));
}

/**
 * api请求方式
 * @param {String} url
 * @param {Any} params
 * @param {Object} config
 * @returns
 */
export function GET<T = undefined>(url: string, params = {}, config: ConfigType = {}): Promise<T> {
  return request(url, params, config, 'GET');
}

export function POST<T = undefined>(url: string, data = {}, config: ConfigType = {}): Promise<T> {
  return request(url, data, config, 'POST');
}

export function PUT<T = undefined>(url: string, data = {}, config: ConfigType = {}): Promise<T> {
  return request(url, data, config, 'PUT');
}

export function DELETE<T = undefined>(url: string, data = {}, config: ConfigType = {}): Promise<T> {
  return request(url, data, config, 'DELETE');
}