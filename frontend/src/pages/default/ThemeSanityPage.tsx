import { useState } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const chartData = [
  { month: "Jan", a: 12, b: 9 },
  { month: "Feb", a: 18, b: 14 },
  { month: "Mar", a: 16, b: 19 },
  { month: "Apr", a: 22, b: 17 },
  { month: "May", a: 20, b: 24 },
  { month: "Jun", a: 26, b: 21 },
];

export default function ThemeSanityPage() {
  const { setTheme, resolvedTheme } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-full bg-background text-foreground p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Theme Sanity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Current theme: <span className="text-foreground font-medium">{resolvedTheme ?? "light"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setTheme("light")}>Light</Button>
          <Button size="sm" variant="outline" onClick={() => setTheme("dark")}>Dark</Button>
          <Button size="sm" variant="secondary" onClick={() => setTheme("system")}>System</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Background</p>
          <p className="text-sm mt-2">bg-background / text-foreground</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Card</p>
          <p className="text-sm mt-2">bg-card / text-card-foreground</p>
        </div>
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Muted</p>
          <p className="text-sm mt-2">bg-muted / text-muted-foreground</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Primary</p>
          <div className="mt-2 h-8 rounded-md bg-primary" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Core Controls</CardTitle>
          <CardDescription>Button, input, select, dialog, dropdown, tabs, table</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Token Check</DialogTitle>
                  <DialogDescription>
                    Dialog should use popover/background/border tokens.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Dropdown</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Action one</DropdownMenuItem>
                <DropdownMenuItem>Action two</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Input token check" />
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="table" className="w-full">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="link">Link</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Atlas AB</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell className="text-right">82</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Nordic Oy</TableCell>
                      <TableCell>Watch</TableCell>
                      <TableCell className="text-right">64</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="link">
              <p className="text-sm text-muted-foreground">
                Link color should inherit primary token: <a href="#">token link example</a>
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
        <aside className="rounded-lg border border-sidebar-border bg-sidebar-bg p-3 text-sidebar-fg">
          <p className="px-3 py-2 text-xs uppercase tracking-wide text-sidebar-muted">Sidebar</p>
          <nav className="space-y-1">
            <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-muted hover:bg-sidebar-hover-bg hover:text-sidebar-fg">
              Overview
            </button>
            <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm bg-sidebar-active-bg text-sidebar-active-fg font-medium">
              Theme Sanity
            </button>
            <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-muted hover:bg-sidebar-hover-bg hover:text-sidebar-fg">
              Reports
            </button>
          </nav>
        </aside>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chart Tokens</CardTitle>
            <CardDescription>Series use chart-1 and chart-2, grid uses border</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={{ stroke: "hsl(var(--border))" }} />
                  <Tooltip
                    contentStyle={{
                      borderColor: "hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Line type="monotone" dataKey="a" name="Series A" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="b" name="Series B" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
