import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Hourglass, IndianRupee } from "lucide-react";

export function FeesSummary({
  totals,
  count,
}: {
  totals: { prev: number; due: number; total: number };
  count: number;
}) {
  const fmt = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Previous Balance
          </CardTitle>
          <History className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              totals.prev > 0
                ? "text-red-600"
                : totals.prev < 0
                ? "text-emerald-600"
                : ""
            }`}
          >
            {fmt.format(totals.prev)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total pending from previous sessions
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Due</CardTitle>
          <Hourglass className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              totals.due > 0
                ? "text-red-600"
                : totals.due < 0
                ? "text-emerald-600"
                : ""
            }`}
          >
            {fmt.format(totals.due)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total due for the current session
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Outstanding
          </CardTitle>
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              totals.total > 0
                ? "text-red-700"
                : totals.total < 0
                ? "text-emerald-700"
                : ""
            }`}
          >
            {fmt.format(totals.total)}
          </div>
          <p className="text-xs text-muted-foreground">
            Across {count} filtered students
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
