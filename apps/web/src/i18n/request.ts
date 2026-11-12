import { getRequestConfig } from "next-intl/server";

import { serverEnv } from "@/lib/server/env";

/**
 * English only for now (design system §2). Every interface string still goes
 * through a key so Indonesian can be added without touching components.
 */
export default getRequestConfig(async () => {
  const locale = "en";
  return {
    locale,
    timeZone: serverEnv().APP_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
