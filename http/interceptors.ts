export type Interceptor<T> = {
    onFulfilled: (val: T) => T | Promise<T>;
    onRejected?: (err: any) => any;
  };
  
  export class InterceptorManager<T> {
    private interceptors: Interceptor<T>[] = [];
  
    use(onFulfilled: Interceptor<T>["onFulfilled"], onRejected?: Interceptor<T>["onRejected"]) {
      this.interceptors.push({ onFulfilled, onRejected });
    }
  
    async run(value: T): Promise<T> {
      let result = value;
      for (const { onFulfilled } of this.interceptors) {
        result = await onFulfilled(result);
      }
      return result;
    }
  }