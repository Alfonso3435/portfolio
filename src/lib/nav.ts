import { features } from "@/lib/features";

// The main tabs. Header and footer both read from here.
export interface NavItem {
  href: string;
  label: string;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/ask", label: "Ask Alfonso" },
  { href: "/hire-me-maybe", label: "Hire Me Maybe" },
  { href: "/contact", label: "Contact" },
].filter((item) => features.lab || item.href !== "/ask");

/** "/projects/identifeye" should still highlight the Projects tab. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
