import { Mail, MapPin, Phone } from "lucide-react";

const socialPlatforms = [
  { name: "WhatsApp", href: "https://wa.me/250790222835" },
  { name: "Instagram", href: "https://www.instagram.com/" },
  { name: "YouTube", href: "https://www.youtube.com/" },
  { name: "Facebook", href: "https://www.facebook.com/" },
  { name: "X", href: "https://x.com/" },
  { name: "LinkedIn", href: "https://www.linkedin.com/" },
] as const;

function SocialIcon({
  platform,
}: {
  platform: (typeof socialPlatforms)[number]["name"];
}) {
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 place-items-center rounded-xl border border-rule bg-white text-pine transition-colors group-hover:border-pine/30 group-hover:bg-paper"
    >
      {platform === "WhatsApp" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="currentColor"
        >
          <path d="M12 2a9.8 9.8 0 0 0-8.42 14.82L2.3 21.7l5.01-1.25A9.8 9.8 0 1 0 12 2Zm0 17.8a8 8 0 0 1-4.08-1.12l-.29-.17-2.97.74.77-2.89-.19-.3A8 8 0 1 1 12 19.8Zm4.4-5.98c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.02-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.58.18 1.1.15 1.51.09.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
        </svg>
      )}
      {platform === "Instagram" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      )}
      {platform === "YouTube" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="currentColor"
        >
          <path d="M21.58 7.19a2.99 2.99 0 0 0-2.1-2.12C17.62 4.55 12 4.55 12 4.55s-5.62 0-7.48.52a2.99 2.99 0 0 0-2.1 2.12A31.1 31.1 0 0 0 1.9 12a31.1 31.1 0 0 0 .52 4.81 2.99 2.99 0 0 0 2.1 2.12c1.86.52 7.48.52 7.48.52s5.62 0 7.48-.52a2.99 2.99 0 0 0 2.1-2.12A31.1 31.1 0 0 0 22.1 12a31.1 31.1 0 0 0-.52-4.81ZM10 15.3V8.7l5.7 3.3-5.7 3.3Z" />
        </svg>
      )}
      {platform === "Facebook" && (
        <span aria-hidden="true" className="text-xl font-bold leading-none">
          f
        </span>
      )}
      {platform === "X" && (
        <span aria-hidden="true" className="text-lg font-semibold leading-none">
          X
        </span>
      )}
      {platform === "LinkedIn" && (
        <span aria-hidden="true" className="text-sm font-bold leading-none">
          in
        </span>
      )}
    </span>
  );
}

export function SocialLinks() {
  return (
    <section aria-label="Social media">
      <h2 className="text-sm font-semibold text-pine">Follow us</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {socialPlatforms.map(({ name, href }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${name}${name === "WhatsApp" ? " chat" : ""} in a new tab`}
            title={name}
            className="group inline-flex rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cross focus-visible:outline-offset-2"
          >
            <SocialIcon platform={name} />
          </a>
        ))}
      </div>
    </section>
  );
}

export function CustomerSupportDetails() {
  return (
    <section>
      <h2 className="text-sm font-semibold text-pine">Customer support</h2>
      <p className="mt-1 text-sm text-muted">
        Need help with Pharmacy Desk? Reach our support team.
      </p>
      <address className="mt-4 flex flex-col items-start gap-3 text-sm not-italic text-muted">
        <span className="inline-flex items-center gap-2">
          <MapPin className="h-4 w-4 text-ok" aria-hidden="true" />
          Kigali, Rwanda
        </span>
        <a
          href="mailto:pharmacydesk@gmail.com"
          className="inline-flex items-center gap-2 transition hover:text-pine"
        >
          <Mail className="h-4 w-4 text-ok" aria-hidden="true" />
          pharmacydesk@gmail.com
        </a>
        <a
          href="tel:+250790222835"
          className="inline-flex items-center gap-2 transition hover:text-pine"
        >
          <Phone className="h-4 w-4 text-ok" aria-hidden="true" />
          +250 790 222 835
        </a>
      </address>
    </section>
  );
}

export default function CustomerSupportFooter() {
  return (
    <footer
      id="customer-support"
      className="border-t border-rule bg-paper/60 px-5 py-6 md:px-8 print:hidden"
    >
      <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 sm:items-start lg:grid-cols-[1fr_auto_auto]">
        <CustomerSupportDetails />
        <SocialLinks />
      </div>
    </footer>
  );
}
