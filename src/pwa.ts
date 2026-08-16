export function shouldRegisterServiceWorker(isProduction: boolean, hasServiceWorker: boolean) {
  return isProduction && hasServiceWorker;
}
