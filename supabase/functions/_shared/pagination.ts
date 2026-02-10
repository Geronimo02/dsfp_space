export type QueryParams = {
  page: number;
  limit: number;
  sort?: string;
  order: "asc" | "desc";
  search?: string;
};

export function parseQueryParams(url: URL): QueryParams {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const sort = url.searchParams.get("sort") ?? undefined;
  const order = (url.searchParams.get("order") ?? "desc") as "asc" | "desc";
  const search = url.searchParams.get("search") ?? undefined;

  return { page, limit, sort, order, search };
}

export function getPaginationMeta(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export type PaginatedResponse<T> = {
  items: T[];
  pagination: ReturnType<typeof getPaginationMeta>;
};
