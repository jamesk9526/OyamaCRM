// LoginBrandPanel: shared OyamaCRM auth branding with the same curved brand language as the app shell.
import Image from "next/image";
import { OYAMA_PRODUCT_LOGO_LIGHT } from "@/app/lib/product-branding";

function BrandCurveSvg({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 760 360" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="login-brand-glow" cx="16%" cy="16%" r="52%">
          <stop offset="0%" stopColor="#60cdff" stopOpacity="0.34" />
          <stop offset="58%" stopColor="#0f6cbd" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#061a36" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="login-brand-scoop" x1="0%" y1="0%" x2="100%" y2="92%">
          <stop offset="0%" stopColor="#061a36" />
          <stop offset="58%" stopColor="#0a3d62" />
          <stop offset="100%" stopColor="#0f6cbd" />
        </linearGradient>
      </defs>
      <path
        d="M0 0H760V188C710 217 660 242 589 257C487 279 391 247 293 254C188 261 87 303 0 353Z"
        fill="url(#login-brand-scoop)"
        stroke="#0f6cbd"
        strokeLinejoin="round"
        strokeWidth={2.25}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0 0H760V188C710 217 660 242 589 257C487 279 391 247 293 254C188 261 87 303 0 353Z"
        fill="url(#login-brand-glow)"
      />
    </svg>
  );
}

export function LoginMobileBrand() {
  return (
    <div className="relative mb-7 overflow-hidden border border-[#0f548c] bg-[linear-gradient(165deg,#061a36_0%,#0a3d62_58%,#0f6cbd_100%)] shadow-[0_18px_50px_rgba(2,12,9,0.25)] lg:hidden">
      <BrandCurveSvg className="absolute inset-x-0 top-0 h-28 w-full" />
      <div className="relative z-10 flex min-h-28 items-center px-6">
        <Image
          src={OYAMA_PRODUCT_LOGO_LIGHT}
          alt="OyamaCRM v1.45b"
          width={220}
          height={62}
          priority
          className="h-auto w-[164px] object-contain object-left brightness-110"
        />
      </div>
    </div>
  );
}

export default function LoginBrandPanel() {
  return (
    <section className="relative hidden overflow-hidden border-r border-[#0f548c] bg-[radial-gradient(circle_at_24%_0%,rgba(96,205,255,0.24),transparent_42%),linear-gradient(180deg,#061a36_0%,#082b4b_44%,#061a36_100%)] lg:flex">
      <BrandCurveSvg className="absolute inset-x-0 top-0 h-[360px] w-full" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-[#60cdff]/18 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-12 left-14 h-44 w-44 rounded-full bg-[#c7e0f4]/10 blur-3xl" />

      <div className="relative z-10 flex min-h-full w-full flex-col justify-between px-12 py-11 xl:px-16">
        <div>
          <Image
            src={OYAMA_PRODUCT_LOGO_LIGHT}
            alt="OyamaCRM v1.45b"
            width={260}
            height={74}
            priority
            className="h-auto w-[190px] object-contain object-left brightness-110 xl:w-[218px]"
          />
        </div>

        <div className="max-w-xl pb-8">
          <div className="mb-8 inline-flex items-center gap-2 border border-[#60cdff]/50 bg-[#0f548c]/30 px-3 py-1.5 text-xs font-semibold text-[#e6f7ff] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#60cdff]" />
            Enterprise nonprofit operations
          </div>
          <h1 className="text-[2.7rem] font-semibold leading-[1.08] tracking-tight text-white xl:text-6xl">
            Your nonprofit,
            <br />
            fully connected.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#d7efff]">
            Stewardship, campaigns, client services, and events in one calm operating system for real nonprofit teams.
          </p>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["DonorCRM", "Stewardship", "bg-[#60cdff]"],
              ["Events", "Fundraising", "bg-amber-500"],
            ].map(([label, helper, dot]) => (
              <div key={label} className="border border-[#60cdff]/25 bg-[#061a36]/45 p-3 shadow-sm backdrop-blur">
                <span className={`mb-3 block h-2 w-2 rounded-full ${dot}`} />
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-[11px] text-[#c7e0f4]">{helper}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
