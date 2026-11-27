import copy
from typing import Any, Dict, List, Optional

class FakeQueryResponse:
    def __init__(self, data: Any, count: Optional[int] = None):
        self.data = data
        self.count = count

class FakeQueryBuilder:
    def __init__(self, table_name: str, tables: Dict[str, List[Dict[str, Any]]]):
        self.table_name = table_name
        self.tables = tables
        self._action = "select"
        self._select_fields = "*"
        self._filters = []
        self._orders = []
        self._range = None
        self._limit = None
        self._insert_data = None
        self._update_data = None
        self._count_mode = None

    def select(self, fields: str = "*", count: Optional[str] = None):
        self._action = "select"
        self._select_fields = fields
        self._count_mode = count
        return self

    def insert(self, data: Any):
        self._action = "insert"
        self._insert_data = data
        return self

    def upsert(self, data: Any):
        self._action = "upsert"
        self._insert_data = data
        return self

    def update(self, data: Dict[str, Any]):
        self._action = "update"
        self._update_data = data
        return self

    def delete(self):
        self._action = "delete"
        return self

    def eq(self, column: str, value: Any):
        self._filters.append(lambda r: r.get(column) == value)
        return self

    def neq(self, column: str, value: Any):
        self._filters.append(lambda r: r.get(column) != value)
        return self

    def in_(self, column: str, values: List[Any]):
        self._filters.append(lambda r: r.get(column) in values)
        return self

    def is_(self, column: str, value: Any):
        if value in ("null", "NULL", None):
            self._filters.append(lambda r: r.get(column) is None)
        elif value in ("true", "TRUE", True):
            self._filters.append(lambda r: r.get(column) is True)
        elif value in ("false", "FALSE", False):
            self._filters.append(lambda r: r.get(column) is False)
        else:
            self._filters.append(lambda r: r.get(column) is value)
        return self

    @property
    def not_(self):
        class _NotHelper:
            def __init__(self, builder):
                self.builder = builder
            def is_(self, column: str, value: Any):
                if value in ("null", "NULL", None):
                    self.builder._filters.append(lambda r: r.get(column) is not None)
                elif value in ("true", "TRUE", True):
                    self.builder._filters.append(lambda r: r.get(column) is not True)
                elif value in ("false", "FALSE", False):
                    self.builder._filters.append(lambda r: r.get(column) is not False)
                else:
                    self.builder._filters.append(lambda r: r.get(column) != value)
                return self.builder
        return _NotHelper(self)

    def gte(self, column: str, value: Any):
        self._filters.append(lambda r: (r.get(column) or "") >= value)
        return self

    def lte(self, column: str, value: Any):
        self._filters.append(lambda r: (r.get(column) or "") <= value)
        return self

    def ilike(self, column: str, pattern: str):
        val = pattern.replace("%", "").lower()
        self._filters.append(lambda r: val in str(r.get(column, "")).lower())
        return self

    def order(self, column: str, desc: bool = False):
        self._orders.append((column, desc))
        return self

    def range(self, start: int, end: int):
        self._range = (start, end)
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def single(self):
        # In supabase-py, .single() returns single object or raises error if empty
        return self

    def execute(self) -> FakeQueryResponse:
        rows = self.tables.setdefault(self.table_name, [])

        if self._action == "insert":
            records = self._insert_data if isinstance(self._insert_data, list) else [self._insert_data]
            inserted = []
            for r in records:
                item = copy.deepcopy(r)
                if "id" not in item:
                    import uuid
                    item["id"] = str(uuid.uuid4())
                rows.append(item)
                inserted.append(item)
            res_data = inserted
            return FakeQueryResponse(data=res_data, count=len(inserted))

        if self._action == "upsert":
            records = self._insert_data if isinstance(self._insert_data, list) else [self._insert_data]
            upserted = []
            for r in records:
                item = copy.deepcopy(r)
                key = item.get("id")
                match = None
                if key:
                    for existing in rows:
                        if existing.get("id") == key:
                            match = existing
                            break
                if match:
                    match.update(item)
                    upserted.append(match)
                else:
                    if "id" not in item:
                        import uuid
                        item["id"] = str(uuid.uuid4())
                    rows.append(item)
                    upserted.append(item)
            return FakeQueryResponse(data=upserted, count=len(upserted))

        if self._action == "update":
            matched = []
            for r in rows:
                if all(f(r) for f in self._filters):
                    r.update(copy.deepcopy(self._update_data))
                    matched.append(copy.deepcopy(r))
            return FakeQueryResponse(data=matched, count=len(matched))

        if self._action == "delete":
            kept = []
            deleted = []
            for r in rows:
                if all(f(r) for f in self._filters):
                    deleted.append(r)
                else:
                    kept.append(r)
            self.tables[self.table_name] = kept
            return FakeQueryResponse(data=deleted, count=len(deleted))

        # Select
        filtered = [copy.deepcopy(r) for r in rows if all(f(r) for f in self._filters)]
        for col, desc in self._orders:
            filtered.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=desc)

        total_count = len(filtered)
        if self._range:
            start, end = self._range
            filtered = filtered[start : end + 1]
        elif self._limit:
            filtered = filtered[: self._limit]

        return FakeQueryResponse(data=filtered, count=total_count)

class FakeRPC:
    def __init__(self, rpc_handlers: Dict[str, Any]):
        self.handlers = rpc_handlers

    def __call__(self, func_name: str, params: Optional[Dict[str, Any]] = None):
        handler = self.handlers.get(func_name)
        data = handler(params) if handler else []
        class _RpcQuery:
            def execute(self):
                return FakeQueryResponse(data=data)
        return _RpcQuery()

class FakeStorageBucket:
    def __init__(self, name: str):
        self.name = name
        self.objects = []

    def create_signed_url(self, path: str, expires_in: int):
        return {"signedURL": f"https://mock-storage.test/{self.name}/{path}?token=mock"}

    def list(self, path: str = "", options: Optional[dict] = None):
        return [{"name": obj} for obj in self.objects if obj.startswith(path)]

    def remove(self, paths: List[str]):
        self.objects = [o for o in self.objects if o not in paths]
        return [{"name": p} for p in paths]

class FakeStorage:
    def __init__(self):
        self._buckets = {}

    def from_(self, bucket: str):
        if bucket not in self._buckets:
            self._buckets[bucket] = FakeStorageBucket(bucket)
        return self._buckets[bucket]

class FakeAuthAdmin:
    def __init__(self):
        self.users = {}
        self.banned_users = {}

    def update_user_by_id(self, uid: str, attributes: dict):
        if "ban_duration" in attributes:
            self.banned_users[uid] = attributes["ban_duration"]
        return {"id": uid, "attributes": attributes}

    def delete_user(self, uid: str, should_soft_delete: bool = False):
        self.users.pop(uid, None)
        return None

class FakeAuth:
    def __init__(self):
        self.admin = FakeAuthAdmin()

class FakeSupabaseClient:
    def __init__(self, initial_tables: Optional[Dict[str, List[Dict[str, Any]]]] = None):
        self.tables = initial_tables or {}
        self.rpc_handlers = {}
        self.rpc = FakeRPC(self.rpc_handlers)
        self.storage = FakeStorage()
        self.auth = FakeAuth()

    def table(self, name: str) -> FakeQueryBuilder:
        return FakeQueryBuilder(name, self.tables)
