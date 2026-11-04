export type PaginationMeta = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type AppSuccessOptions<M extends object = never> = {
  meta?: M;
};

export type AppSuccessBody<T, M extends object = never> = {
  data: T;
} & (M extends never ? object : { meta?: M });

export class AppSuccess<T, M extends object = never> {
  public readonly data: T;
  public readonly meta?: M;

  constructor(data: T, options?: AppSuccessOptions<M>) {
    this.data = data;

    if (options?.meta !== undefined) {
      this.meta = options.meta;
    }
  }

  toJSON(): AppSuccessBody<T, M> {
    return {
      data: this.data,
      ...(this.meta !== undefined ? { meta: this.meta } : {}),
    } as AppSuccessBody<T, M>;
  }
}
