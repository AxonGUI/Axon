import {
  AxonCall,
  SmartPYControllerName,
  SmartPYControllerPropName,
} from "./AxonJSCall";

type AxonControllerProxy<K extends SmartPYControllerName> = {
  [P in SmartPYControllerPropName<K>]: ((
    args?: any[],
    kwargs?: any,
    timeout?: number,
  ) => Promise<any>) &
    Promise<any>;
};

type AxonProxy = {
  [K in SmartPYControllerName]: AxonControllerProxy<K>;
};

export const Axon = new Proxy(
  {},
  {
    get(_, controller_id: string) {
      return new Proxy(
        {},
        {
          get(_, prop: string) {
            const dispatcher = (
              args?: any[],
              kwargs?: any,
              timeout?: number,
            ) => {
              // 1. 如果被當作函數調用, Axon.Controller.func()
              return AxonCall.call({
                controller_id,
                func: prop,
                args,
                kwargs,
                timeout,
              });
            };
            // 2. 如果被當作屬性訪問, Axon.Controller.var
            let getVarPromise: Promise<any> | undefined;

            dispatcher.then = () => {
              if (!getVarPromise) {
                getVarPromise = AxonCall.getVar({
                  controller_id,
                  var_name: prop,
                });
              }
              return getVarPromise.then.apply(getVarPromise, arguments as any);
            };

            dispatcher.catch = function () {
              if (!getVarPromise) {
                getVarPromise = AxonCall.getVar({
                  controller_id,
                  var_name: prop,
                });
              }
              return getVarPromise.catch.apply(getVarPromise, arguments as any);
            };

            dispatcher.finally = function () {
              if (!getVarPromise) {
                getVarPromise = AxonCall.getVar({
                  controller_id,
                  var_name: prop,
                });
              }
              return getVarPromise.finally.apply(
                getVarPromise,
                arguments as any,
              );
            };
            return dispatcher;
          },
          set(_, prop: string, value) {
            AxonCall.setVar({
              controller_id,
              var_name: prop,
              value,
            });
            return true;
          },
        },
      );
    },
  },
) as AxonProxy;
