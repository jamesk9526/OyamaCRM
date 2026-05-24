// LoginBrandPanel: shared OyamaCRM auth branding with the same curved brand language as the app shell.
import Image from "next/image";

function BrandCurveSvg({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 760 360" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="login-brand-glow" cx="16%" cy="16%" r="52%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.34" />
          <stop offset="58%" stopColor="#10b981" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="login-brand-scoop" x1="0%" y1="0%" x2="100%" y2="92%">
          <stop offset="0%" stopColor="#012c25" />
          <stop offset="58%" stopColor="#075443" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <path
        d="M0 0H760V188C710 217 660 242 589 257C487 279 391 247 293 254C188 261 87 303 0 353Z"
        fill="url(#login-brand-scoop)"
        stroke="#0b6b5c"
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
    <div className="relative mb-7 overflow-hidden rounded-[28px] border border-emerald-900/10 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)] lg:hidden">
      <BrandCurveSvg className="absolute inset-x-0 top-0 h-28 w-full" />
      <div className="relative z-10 flex min-h-28 items-center px-6">
        <Image
          src="/branding/oyama-crm-logo-final.png"
          alt="OyamaCRM"
          width={220}
          height={62}
          priority
          className="h-auto w-[164px] object-contain object-left"
        />
      </div>
    </div>
  );
}

export default function LoginBrandPanel() {
  return (
    <section className="relative hidden overflow-hidden border-r border-slate-200/80 bg-white lg:flex">
      <BrandCurveSvg className="absolute inset-x-0 top-0 h-[360px] w-full" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-emerald-50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-12 left-14 h-44 w-44 rounded-full bg-slate-100/70 blur-3xl" />

      <div className="relative z-10 flex min-h-full w-full flex-col justify-between px-12 py-11 xl:px-16">
        <div>
          <Image
            src="/branding/oyama-crm-logo-final.png"
            alt="OyamaCRM"
            width={260}
            height={74}
            priority
            className="h-auto w-[190px] object-contain object-left xl:w-[218px]"
          />
        </div>

        <div className="max-w-xl pb-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Nonprofit relationship workspace
          </div>
          <h1 className="text-[2.7rem] font-semibold leading-[1.08] tracking-tight text-slate-950 xl:text-6xl">
            Your nonprofit,
            <br />
            fully connected.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-600">
            Stewardship, campaigns, client services, and events in one calm operating system for real nonprofit teams.
          </p>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["DonorCRM", "Stewardship", "bg-emerald-500"],
              ["Compassion", "Client care", "bg-blue-500"],
              ["Events", "Fundraising", "bg-amber-500"],
            ].map(([label, helper, dot]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm">
                <span className={`mb-3 block h-2 w-2 rounded-full ${dot}`} />
                <p className="text-xs font-semibold text-slate-950">{label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{helper}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
