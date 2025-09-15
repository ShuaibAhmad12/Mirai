"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  User,
  Clock,
  TrendingUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";

type Option = {
  id: string;
  name?: string;
  code?: string | null;
  title?: string;
};

export function FeesFilters(props: {
  q: string | null;
  college_id: string | null;
  course_id: string | null;
  session_id: string | null;
  current_year: number | null;
  sort: "full_name" | "total_outstanding" | "current_due";
  order: "asc" | "desc";
  colleges: Option[];
  courses: Option[];
  sessions: Option[];
}) {
  const years = ["1", "2", "3", "4", "5"];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Filter and Sort</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <form method="get" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
            <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-2">
              <Label htmlFor="search" className="text-xs font-medium">
                Search
              </Label>
              <Input
                id="search"
                name="q"
                placeholder="Name or enrollment"
                className="mt-1 h-8"
                defaultValue={props.q ?? ""}
              />
            </div>
            <div className="col-span-1">
              <Label htmlFor="college" className="text-xs font-medium">
                College
              </Label>
              <Select
                name="college_id"
                defaultValue={props.college_id ?? "all"}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {props.colleges.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="course" className="text-xs font-medium">
                Course
              </Label>
              <Select name="course_id" defaultValue={props.course_id ?? "all"}>
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {props.courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="session" className="text-xs font-medium">
                Session
              </Label>
              <Select
                name="session_id"
                defaultValue={props.session_id ?? "all"}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {props.sessions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.title || s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="year" className="text-xs font-medium">
                Year
              </Label>
              <Select
                name="current_year"
                defaultValue={
                  props.current_year ? String(props.current_year) : "any"
                }
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      Year {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label className="text-xs font-medium">Sort & Order</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex rounded-md border" role="group">
                  <Button
                    type="button"
                    variant={props.sort === "full_name" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-r-none border-r"
                    onClick={(e) => {
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        const sortInput = form.querySelector(
                          'input[name="sort"]'
                        ) as HTMLInputElement;
                        if (sortInput) sortInput.value = "full_name";
                        form.requestSubmit();
                      }
                    }}
                  >
                    <User className="h-4 w-4 mr-1" />
                    Name
                  </Button>
                  <Button
                    type="button"
                    variant={props.sort === "current_due" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none border-r"
                    onClick={(e) => {
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        const sortInput = form.querySelector(
                          'input[name="sort"]'
                        ) as HTMLInputElement;
                        if (sortInput) sortInput.value = "current_due";
                        form.requestSubmit();
                      }
                    }}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Due
                  </Button>
                  <Button
                    type="button"
                    variant={
                      props.sort === "total_outstanding" ? "default" : "ghost"
                    }
                    size="sm"
                    className="rounded-l-none"
                    onClick={(e) => {
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        const sortInput = form.querySelector(
                          'input[name="sort"]'
                        ) as HTMLInputElement;
                        if (sortInput) sortInput.value = "total_outstanding";
                        form.requestSubmit();
                      }
                    }}
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Total
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    const form = e.currentTarget.closest("form");
                    if (form) {
                      const orderInput = form.querySelector(
                        'input[name="order"]'
                      ) as HTMLInputElement;
                      if (orderInput) {
                        orderInput.value =
                          props.order === "asc" ? "desc" : "asc";
                        form.requestSubmit();
                      }
                    }
                  }}
                >
                  {props.order === "asc" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {props.order === "asc" ? "Ascending" : "Descending"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <input type="hidden" name="page" value={1} />
          <input type="hidden" name="sort" value={props.sort} />
          <input type="hidden" name="order" value={props.order} />
          <div className="flex items-center justify-between pt-2">
            <Button asChild variant="link" className="p-0 h-8 text-xs">
              <Link href="/fees">Reset filters</Link>
            </Button>
            <Button type="submit" variant="default" size="sm">
              Apply Filters
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
