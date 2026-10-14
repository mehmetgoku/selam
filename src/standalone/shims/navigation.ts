import { navigate, usePath } from "./router";

export const useRouter = () => ({ push: navigate, replace: navigate, back: () => history.back() });
export const usePathname = usePath;
export const notFound = () => {
  throw new Error("not found");
};
