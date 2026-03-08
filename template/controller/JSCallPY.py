from axon import AxonController


@AxonController("TemplateView")
class JSCallPYController:
    def __init__(self) -> None:
        self.count = 0

    def onCall(self, arg1, arg2, **kwargs):
        print("JSCallPYCaontroller-onCall")
        print(f"{arg1=}")
        print(f"{arg2=}")
        print(f"{kwargs=}")
        self.count += 1
        return f"msg from py, click count {self.count}"
