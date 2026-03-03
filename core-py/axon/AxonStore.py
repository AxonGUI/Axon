from typing import Any, Optional

from .AxonJSCallHandler import AxonController


@AxonController(shared=True)
class _AxonStore:
    def __init__(self):
        self.store = {}

    def __call__(self, web_name: Optional[str] = None):
        pass

    # def set(self, key: str, value: Any):
    #     self._store[key] = value

    # def get(self, key: str) -> Any:
    #     return self._store.get(key)


AxonStore = _AxonStore()

AxonController.register(_AxonStore, id="AxonStore")
