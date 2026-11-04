/** Synthetic persistence boundary for HTTP workflow tests. This does not prove MySQL migrations. */
type Row = Record<string, unknown>;
export const careRows: Record<string, Row[]> = {};
let sequence = 0;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every((part) => matches(row, part as Row));
    if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
    if (key === "organizationId_userId") return matches(row, value as Row);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const filter = value as Row;
      return Object.entries(filter).every(([operator, operand]) => {
        if (operator === "in") return (operand as unknown[]).includes(row[key]);
        if (operator === "not") return row[key] !== operand;
        if (operator === "lt") return (row[key] as number) < (operand as number);
        if (operator === "gt") return (row[key] as number) > (operand as number);
        if (operator === "gte") return (row[key] as number) >= (operand as number);
        if (operator === "lte") return (row[key] as number) <= (operand as number);
        if (operator === "contains") return String(row[key]).toLowerCase().includes(String(operand).toLowerCase());
        throw new Error(`Unsupported synthetic test operator: ${operator}`);
      });
    }
    return row[key] === value;
  });
}

function selectRow(row: Row, args: Row): Row {
  if (args.select) return Object.fromEntries(Object.entries(args.select as Row).filter(([, selected]) => selected).map(([key]) => [key, row[key]]));
  if (!args.include) return { ...row };
  return { ...row, client: careRows.compassionClient?.find((client) => client.id === row.clientId), assignedStaff: careRows.user?.find((user) => user.id === row.assignedStaffId) ?? null, assignedCompassionStaff: null, case: null };
}

export function resetCareRows() { for (const key of Object.keys(careRows)) careRows[key] = []; sequence = 0; }

export const careMemoryDatabase = new Proxy({}, {
  get(_target, property: string) {
    const rows = () => careRows[property] ||= [];
    const find = (args: Row) => rows().filter((row) => matches(row, args.where as Row));
    return {
      async findFirst(args: Row = {}) { const row = find(args)[0]; return row ? selectRow(row, args) : null; },
      async findUnique(args: Row = {}) { const row = find(args)[0]; return row ? selectRow(row, args) : null; },
      async findMany(args: Row = {}) {
        const found = [...find(args)];
        const ordering = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) as Row[] : [];
        found.sort((a, b) => {
          for (const clause of ordering) for (const [key, direction] of Object.entries(clause)) {
            const aa = a[key] as number; const bb = b[key] as number;
            if (aa < bb) return direction === "desc" ? 1 : -1;
            if (aa > bb) return direction === "desc" ? -1 : 1;
          }
          return 0;
        });
        return found.slice(Number(args.skip ?? 0), args.take ? Number(args.skip ?? 0) + Number(args.take) : undefined).map((row) => selectRow(row, args));
      },
      async count(args: Row = {}) { return find(args).length; },
      async groupBy(args: Row) {
        const groups = new Map<string, { fields: Row; count: number }>();
        for (const row of find(args)) {
          const fields = Object.fromEntries((args.by as string[]).map((key) => [key, row[key]])); const key = JSON.stringify(fields);
          const group = groups.get(key) ?? { fields, count: 0 }; group.count++; groups.set(key, group);
        }
        return [...groups.values()].map((group) => ({ ...group.fields, _count: { _all: group.count } }));
      },
      async create(args: Row) {
        const row = { id: `synthetic-${++sequence}`, createdAt: new Date(), updatedAt: new Date(Date.now() + sequence), version: 1, templateVersion: 1, chartId: null, deletedAt: null, status: property === "compassionFollowUp" ? "PENDING" : "DRAFT", ...args.data as Row };
        rows().push(row); return selectRow(row, args);
      },
      async update(args: Row) { const row = find(args)[0]; if (!row) throw new Error("Synthetic record missing"); Object.assign(row, args.data, { updatedAt: new Date(Date.now() + ++sequence) }); return { ...row }; },
      async updateMany(args: Row) { const found = find(args); for (const row of found) Object.assign(row, args.data, { updatedAt: new Date(Date.now() + ++sequence) }); return { count: found.length }; },
    };
  },
});
