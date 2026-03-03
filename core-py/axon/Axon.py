from __future__ import annotations

from calendar import c
from concurrent.futures import Future
from typing import Any, cast

from .AxonPYCall import broadcast as _py_broadcast
from .AxonPYCall import call as _py_call
from .AxonPYCall import getVar as _py_getVar
from .AxonPYCall import setVar as _py_setVar


class _JSProperty:
    def __init__(self, web_name: str, controller_id: str, prop: str) -> None:
        self.controller_id = controller_id
        self.prop = prop
        self._get_future = None
        self.web_name = web_name

    def _ensure_get(self):
        if self._get_future is None:
            self._get_future = _py_getVar(self.web_name, self.controller_id, self.prop)
        return self._get_future

    def __call__(self, *args: Any):
        return _py_call(self.web_name, self.controller_id, self.prop, args)

    def __await__(self):
        return self._ensure_get().result()

    def __getattr__(self, name: str):
        # forward attributes to the lazy future (result, add_done_callback, ..)
        return getattr(self._ensure_get(), name)


class JSProperty(_JSProperty, Future):
    pass


class JSController:
    def __init__(self, web_name: str, controller_id: str) -> None:
        self.controller_id = controller_id
        self.web_name = web_name

    def __getattr__(self, prop: str):
        return cast(
            JSProperty,
            _JSProperty(
                self.web_name,
                self.controller_id,
                prop,
            ),
        )

    def __setattr__(self, prop: str, value: Any):
        _py_setVar(self.web_name, self.controller_id, prop, value).result()


class Axon:
    broadcast: AxonBroadcast

    def __init__(self, web_name: str) -> None:
        self._web_name = web_name

    def __getattr__(self, controller_id: str):
        return JSController(
            self._web_name,
            controller_id,
        )


class BroadcastJSProperty(_JSProperty):
    def __call__(self, *args: Any):  # type: ignore
        return _py_broadcast(self.controller_id, self.prop, args)


class BroadcastJSController(JSController):
    def __getattr__(self, prop: str):  # type: ignore
        return BroadcastJSProperty(
            self.web_name,
            self.controller_id,
            prop,
        )


class AxonBroadcast(Axon):
    def __init__(self):
        super().__init__("__axon__broadcast__")

    def __getattr__(self, controller_id: str):
        return BroadcastJSController(
            self._web_name,
            controller_id,
        )


Axon.broadcast = AxonBroadcast()
