/**
 * AboutPage — OyamaCRM software information, licensing terms, and acknowledgements.
 * Displayed at /settings/about as the final item in the Settings sidebar.
 */

import React from "react";

const CURRENT_YEAR = new Date().getFullYear();
const VERSION = "1.1.0";

/** A soft-ruled section divider with a title. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-1">{title}</h2>
      {children}
    </section>
  );
}

/** A single license term row. */
function LicenseTerm({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-48 shrink-0 text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

/** AboutPage renders the full About & License view inside the Settings layout. */
export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-5">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">OyamaCRM</h1>
          <p className="mt-1 text-sm text-gray-500">
            Version {VERSION} &nbsp;·&nbsp; Nonprofit CRM Platform
          </p>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            OyamaCRM is an integrated nonprofit management platform covering donor
            management, compassion client services, event management, and AI-powered
            stewardship — built to serve pregnancy centers and nonprofits of every size.
          </p>
        </div>
      </div>

      {/* ── Authorship ──────────────────────────────────────────────── */}
      <Section title="Authorship">
        <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
          <LicenseTerm label="Software Author" value="James Knox" />
          <LicenseTerm label="Copyright" value={`© ${CURRENT_YEAR} James Knox. All rights reserved.`} />
          <LicenseTerm label="Platform" value="OyamaCRM — Nonprofit CRM Platform" />
          <LicenseTerm label="Version" value={VERSION} />
        </div>
      </Section>

      {/* ── License ─────────────────────────────────────────────────── */}
      <Section title="License">
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">
              OyamaCRM Free Use License — Nonprofit Edition
            </p>
            <p className="mt-1 text-xs text-green-700">Effective for all versions from 1.0.0 onwards</p>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed">
            Permission is hereby granted, free of charge, to any pregnancy center or
            qualifying nonprofit organization to use, copy, install, and operate this
            software, subject to the terms and conditions set out below.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Free use eligibility criteria</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 pl-1">
              <li>
                The organization is a registered <strong>nonprofit</strong> or{" "}
                <strong>pregnancy care center</strong> operating under applicable
                law (e.g., 501(c)(3) in the United States or equivalent in other
                jurisdictions).
              </li>
              <li>
                The organization&apos;s <strong>total annual revenue does not exceed
                US&nbsp;$1,000,000</strong> (one million US dollars) in the fiscal
                year in which the software is used.
              </li>
              <li>
                Use is for the organization&apos;s own internal operations — not for
                resale, redistribution, or as a hosted service offered to third parties.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Permitted uses (free tier)</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 pl-1">
              <li>Install and run any number of instances for internal organizational use.</li>
              <li>Customize configuration, branding, and workflow settings.</li>
              <li>Import and manage constituent, donor, client, and event data.</li>
              <li>Extend via the provided integration and plugin interfaces.</li>
              <li>Retain all data generated within the platform.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Conditions and restrictions</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 pl-1">
              <li>
                The copyright notice, this license text, and the authorship attribution
                must be retained in any copy or substantial portion of the software,
                including this About page.
              </li>
              <li>
                Organizations whose annual revenue exceeds US&nbsp;$1,000,000 require
                a separate commercial license. Contact the author to discuss terms.
              </li>
              <li>
                You may not remove, obscure, or alter the authorship attribution, the
                copyright notice, or any &ldquo;Powered by OyamaCRM&rdquo; notices
                included in the platform.
              </li>
              <li>
                No warranty is provided. The software is furnished &ldquo;as is&rdquo;
                without warranty of any kind, express or implied.
              </li>
            </ul>
          </div>

          <div className="border-t border-green-200 pt-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.
              IN NO EVENT SHALL THE AUTHOR OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
              DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR
              OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR
              THE USE OR OTHER DEALINGS IN THE SOFTWARE.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Commercial Licensing ────────────────────────────────────── */}
      <Section title="Commercial Licensing">
        <p className="text-sm text-gray-600 leading-relaxed">
          Organizations that do not qualify for the free nonprofit license — including
          nonprofits with annual revenue exceeding US&nbsp;$1,000,000, for-profit
          businesses, SaaS providers, consultancies, and resellers — must obtain a
          separate commercial license before using OyamaCRM.
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          To inquire about commercial licensing, custom development, or enterprise
          support, please contact the author directly.
        </p>
      </Section>

      {/* ── Third-Party Licenses ─────────────────────────────────────── */}
      <Section title="Open Source Components">
        <p className="text-sm text-gray-600 leading-relaxed">
          OyamaCRM is built on open-source technologies. The following major components
          are used under their respective licenses:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { name: "Next.js", license: "MIT", author: "Vercel, Inc." },
            { name: "React", license: "MIT", author: "Meta Platforms, Inc." },
            { name: "Tailwind CSS", license: "MIT", author: "Tailwind Labs, Inc." },
            { name: "Prisma", license: "Apache 2.0", author: "Prisma Data, Inc." },
            { name: "Express", license: "MIT", author: "TJ Holowaychuk et al." },
            { name: "Recharts", license: "MIT", author: "Recharts Group" },
            { name: "TypeScript", license: "Apache 2.0", author: "Microsoft Corp." },
            { name: "Vitest", license: "MIT", author: "Vitest contributors" },
            { name: "Playwright", license: "Apache 2.0", author: "Microsoft Corp." },
            { name: "Electron", license: "MIT", author: "OpenJS Foundation" },
            { name: "intuit-oauth", license: "Apache 2.0", author: "Intuit Inc." },
            { name: "bcrypt / jsonwebtoken", license: "MIT", author: "Various" },
          ].map((dep) => (
            <div
              key={dep.name}
              className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-xs"
            >
              <span className="font-medium text-gray-700">{dep.name}</span>
              <span className="text-gray-500">
                {dep.license} &mdash; {dep.author}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Full dependency license details are available in the{" "}
          <code className="bg-gray-100 px-1 rounded text-gray-700">node_modules</code>{" "}
          directory of each package or at{" "}
          <span className="font-medium text-gray-600">npmjs.com</span>.
        </p>
      </Section>

      {/* ── Special Thank You ────────────────────────────────────────── */}
      <Section title="Special Thanks">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5" aria-hidden="true">🌸</span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-900">
                Pregnancy Care Center — Aurora, Missouri
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                A heartfelt thank you to the dedicated team at the Pregnancy Care Center
                in Aurora, Missouri. Their courageous, compassionate work serving women
                and families in need was the direct inspiration for building OyamaCRM.
                Watching their staff navigate the day-to-day challenges of donor
                stewardship, client care, and volunteer coordination with makeshift tools
                planted the seed that grew into this platform.
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                May this software serve you — and every pregnancy center and nonprofit
                that uses it — with the same care and dedication you show to the
                families who walk through your doors.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          OyamaCRM v{VERSION} &nbsp;·&nbsp; Copyright &copy; {CURRENT_YEAR} James Knox &nbsp;·&nbsp;
          Free for qualifying nonprofits and pregnancy centers with annual revenue ≤ US&nbsp;$1,000,000.
          All other use requires a commercial license.
        </p>
      </div>
    </div>
  );
}
