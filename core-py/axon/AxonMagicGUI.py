import uuid
from concurrent.futures import Future
from typing import Any, Callable, ParamSpec, TypedDict, TypeVar
from PySide6.QtCore import QObject, Signal, Slot

P = ParamSpec("P")
T = TypeVar("T")


class FuncData(TypedDict):
    future: "Future[Any]"
    func: "Callable[..., Any]"
    args: "tuple[Any, ...]"
    kwargs: "dict[str, Any]"


class AxonMagicGUI(QObject):
    f_dict: dict[str, FuncData] = {}
    runSignal = Signal(str)
    # 类属性必须给默认值: 只写注解时 cls.instance 会 AttributeError 而不是 None
    instance: "AxonMagicGUI | None" = None

    def __init__(self) -> None:
        super().__init__()
        self.runSignal.connect(self._run_slot)
        self.__class__.instance = self

    @classmethod
    def run(cls, func: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> Future[T]:
        if cls.instance is None:
            raise RuntimeError(
                "AxonMagicGUI 未初始化: 请先在 Qt 主线程创建 AxonMagicGUI()"
            )
        future: Future[T] = Future()
        key = str(uuid.uuid4())
        cls.f_dict[key] = {
            "future": future,
            "func": func,
            "args": args,
            "kwargs": kwargs,
        }
        cls.instance.runSignal.emit(key)
        return future

    @Slot(str)
    def _run_slot(self, key: str) -> None:
        data = self.f_dict.pop(key)
        try:
            result = data["func"](*data["args"], **data["kwargs"])
            data["future"].set_result(result)
        except Exception as e:
            data["future"].set_exception(e)
