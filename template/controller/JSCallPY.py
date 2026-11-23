from axon import AxonController


@AxonController("TemplateView")
class JSCallPYController:
    def __init__(self) -> None:
        self.count = 0

    def onCall(self, arg1, arg2, **kwargs):
        self.count += 1
        print(f"-----JSCallPYController-onCall- count {self.count}-----")
        print(f"{arg1=}")
        print(f"{arg2=}")
        print(f"{kwargs=}")
        return f"call count {self.count}"
