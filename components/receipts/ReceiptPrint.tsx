"use client";

import * as React from "react";
import Image from "next/image";
import numToWords from "num-to-words";

export interface ReceiptDetailItem {
  code?: string | null;
  name: string;
  paid?: number | null;
  balance?: number | null;
}

export interface ReceiptPrintData {
  receipt_number: string | number;
  receipt_date: string | Date;
  academic_year?: string | null;
  payment_method?: string | null;
  remarks?: string | null;
  details: ReceiptDetailItem[];
  logoUrl?: string; // e.g., "/alpine_logo.png" in public
  college?: {
    name?: string | null;
    code?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    affiliation?: string | null;
    approvedBy?: string | null;
    affiliationWebsite?: string | null; // kept for backward compat
  };
  student?: {
    name?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    enrollmentCode?: string | null;
    courseName?: string | null;
    sessionTitle?: string | null;
    currentYear?: number | string | null;
  };
}

export const ReceiptPrint = React.forwardRef<
  HTMLDivElement,
  { data: ReceiptPrintData }
>(({ data }, ref) => {
  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString();
  };

  const totalPaid = data.details.reduce((s, d) => s + (d.paid || 0), 0);
  const totalBalance = data.details.reduce((s, d) => s + (d.balance || 0), 0);
  const totalPaidInWords = numToWords(totalPaid || 0);
  const yearMap: Record<number, string> = {
    1: "First",
    2: "Second",
    3: "Third",
    4: "Fourth",
    5: "Fifth",
  };

  const formatCurrency = (n: number | null | undefined) =>
    (n ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const displayComponentName = (name?: string | null) => {
    const raw = (name ?? "").trim();
    if (!raw) return raw;
    const low = raw.toLowerCase();
    const alreadyHas = low.includes("(reg. fee)");
    const isAdmission =
      low === "admission fee" ||
      low === "admission" ||
      low.includes("admission");
    return isAdmission && !alreadyHas ? `${raw} (Reg. Fee)` : raw;
  };

  const parentName =
    data.student?.fatherName || data.student?.motherName || null;

  const Content = () => (
    <div className="border border-slate-300 p-3 text-sm text-slate-800">
      {/* Header with logo and college info */}
      <div className="relative mb-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="absolute left-0 top-0">
            {data.logoUrl ? (
              <Image
                src={data.logoUrl}
                alt="College Logo"
                width={140}
                height={140}
                className="h-26 object-contain"
                priority
              />
            ) : null}
          </div>
          <div className="w-full text-center items-center mt-2 pl-12">
            <div className="text-lg font-semibold leading-tight">
              {data.college?.name || "College Name"}
            </div>
            {data.college?.address ? (
              <div className="text-[11px] text-slate-600">
                {data.college.address}
              </div>
            ) : null}
            {data.college?.phone ? (
              <div className="text-[11px] text-slate-600">
                {data.college.phone}
              </div>
            ) : null}
            {data.college?.email || data.college?.website ? (
              <div className="text-[11px] text-slate-600">
                {data.college.email}
                {data.college?.email && data.college?.website ? " | " : ""}
                {data.college.website}
              </div>
            ) : null}
            {data.college?.affiliation ? (
              <div className="text-[11px] text-slate-600">
                Affiliation: {data.college.affiliation}
              </div>
            ) : null}
            {data.college?.approvedBy ? (
              <div className="text-[11px] text-slate-600">
                Approved By: {data.college.approvedBy}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Student + Receipt meta */}
      <div className="grid grid-cols-2 gap-4 border rounded-md p-2 mb-3">
        <div className="text-xs">
          <div>
            <span className="text-slate-500">Receipt No./ Date:</span> #
            {data.receipt_number} / {formatDate(data.receipt_date)}
          </div>

          <div>
            <span className="text-slate-500">Student:</span>{" "}
            {data.student?.name || "-"}
          </div>

          <div>
            <span className="text-slate-500">Course:</span>{" "}
            {data.student?.courseName || "-"}
          </div>
        </div>
        <div className="text-xs text-right">
          <div>
            <span className="text-slate-500">Student Id:</span>{" "}
            {data.student?.enrollmentCode || "-"}
          </div>
          <div>
            <span className="text-slate-500">Session/Year:</span>{" "}
            {data.student?.sessionTitle || data.academic_year || "-"}/
            {typeof data.student?.currentYear === "number"
              ? yearMap[data.student?.currentYear] || data.student?.currentYear
              : data.student?.currentYear ?? "-"}
          </div>

          <div>
            <span className="text-slate-500">Father/Mother:</span>{" "}
            {parentName || "-"}
          </div>
        </div>
      </div>

      {/* Details table */}
      <table className="w-full text-xs border border-slate-200">
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-200 px-2 py-1 text-left">
              Component
            </th>
            <th className="border border-slate-200 px-2 py-1 text-right">
              Paid
            </th>
            <th className="border border-slate-200 px-2 py-1 text-right">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {data.details.map((d, idx) => (
            <tr key={idx}>
              <td className="border border-slate-200 px-2 py-1">
                <span className="inline-flex items-center gap-2">
                  <span>{displayComponentName(d.name)}</span>
                </span>
              </td>
              <td className="border border-slate-200 px-2 py-1 text-right font-mono">
                ₹ {formatCurrency(d.paid)}
              </td>
              <td className="border border-slate-200 px-2 py-1 text-right font-mono">
                ₹ {formatCurrency(d.balance)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-medium">
            <td className="border border-slate-200 px-2 py-1 text-right">
              Totals
            </td>
            <td className="border border-slate-200 px-2 py-1 text-right font-mono">
              ₹ {formatCurrency(totalPaid)}
            </td>
            <td className="border border-slate-200 px-2 py-1 text-right font-mono">
              ₹ {formatCurrency(totalBalance)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer summary */}
      <div className="mt-2 grid grid-cols-2">
        <div className="text-xs text-slate-600">
          <div className="mb-1">
            <span className="text-slate-500">Payment Method:</span>{" "}
            {data.payment_method || "-"}
          </div>
          {data.remarks ? (
            <div className="mt-1">
              <span className="text-slate-500">Remarks:</span> {data.remarks}
            </div>
          ) : null}
        </div>
        <div className="text-right text-xs text-slate-600 pr-1">
          <div className="mb-1">
            <span className="text-slate-500">Amount in Words:</span>{" "}
            {`Rupees ${String(totalPaidInWords).toUpperCase()} Only`}
          </div>
          <div className="mt-6">Authorised Signatory</div>
        </div>
      </div>
      <div className="mt-2 inline-block border border-slate-400 rounded p-2 text-xs text-slate-700">
        <div className="flex items-start">
          <span className="mr-2">•</span>
          <span>Fees once paid is neither refundable nor transferable.</span>
        </div>
        <div className="flex items-start">
          <span className="mr-2">•</span>
          <span>All disputes are subject to Dehradun Jurisdiction only.</span>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={ref} className="p-4">
      <Content />
      <div className="my-3 border-t border-dashed border-slate-400" />
      <Content />
    </div>
  );
});

ReceiptPrint.displayName = "ReceiptPrint";

export default ReceiptPrint;
