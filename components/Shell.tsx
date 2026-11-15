import Link from "next/link";
import {
  Home,
  BookOpen,
  MessageCircle,
  BriefcaseBusiness,
  ShieldCheck,
  Menu,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import Widget from "./Widget";
const links = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/learn", label: "Access my learning", Icon: BookOpen },
  { href: "/support", label: "Human support", Icon: MessageCircle },
  { href: "/jobs", label: "Career space", Icon: BriefcaseBusiness },
  { href: "/dashboard", label: "Tutor workspace", Icon: ShieldCheck },
  {
    href: "/dashboard/signing",
    label: "EthSL signing studio",
    Icon: ShieldCheck,
  },
  { href: "/docs", label: "Help & resources", Icon: HelpCircle },
];
export default function Shell({
  children,
  active = "",
  title = "Savanna learning platform",
}: {
  children: React.ReactNode;
  active?: string;
  title?: string;
}) {
  return (
    <div className="savanna-app">
      <header className="savanna-header">
        <Menu aria-hidden="true" size={22} />
        <Link href="/" aria-label="Savanna home">
          <img
            src="/savanna/assets/img/holberton-logo-full-alx.png"
            alt="ALX"
            width="92"
            height="38"
          />
        </Link>
        <span>Savanna</span>
        <small>Learning with MELA support</small>
      </header>
      <aside className="savanna-sidebar">
        <nav aria-label="Main navigation">
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active === label ? "page" : undefined}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="savanna-profile">
          Learning workspace<span>Digital Bridge · English</span>
        </div>
      </aside>
      <div className="savanna-page">
        <div className="savanna-breadcrumb">
          Savanna <ChevronRight size={14} />
          {title}
        </div>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="page-footer">
          MELA accessibility support · integrated with the Savanna static
          capture
        </footer>
      </div>
      <Widget />
    </div>
  );
}
