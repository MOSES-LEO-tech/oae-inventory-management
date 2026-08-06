"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Users, Store, Bell } from "lucide-react";
import { MOCK_STORES, MOCK_ITEMS } from "@/lib/mock-data";

const MOCK_USERS = [
  { name: "Preview User", email: "preview@oae.dev", role: "admin", store: "Main Stores" },
  { name: "Store Manager", email: "manager@oae.dev", role: "manager", store: "Store B" },
  { name: "Sales Clerk", email: "clerk@oae.dev", role: "clerk", store: "Main Stores" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-ink text-paper",
  manager: "bg-canvas text-ink",
  clerk: "border border-hairline bg-transparent text-ink",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage users, stores, and thresholds.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">
            <Users className="mr-1 h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="stores">
            <Store className="mr-1 h-4 w-4" /> Stores
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <Bell className="mr-1 h-4 w-4" /> Thresholds
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Management</CardTitle>
              <Button size="sm" onClick={() => alert("Add user dialog would open (dev mode)")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add User
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Store</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_USERS.map((user) => (
                      <TableRow key={user.email}>
                        <TableCell className="text-sm font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${ROLE_COLORS[user.role]}`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{user.store}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit user">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Remove user">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stores Tab */}
        <TabsContent value="stores" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Store Management</CardTitle>
              <Button size="sm" onClick={() => alert("Add store dialog would open (dev mode)")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Store
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Name</TableHead>
                      <TableHead className="text-right">Items Count</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_STORES.map((store) => {
                      const itemCount = MOCK_ITEMS.length; // Simplified
                      return (
                        <TableRow key={store.id}>
                          <TableCell className="text-sm font-medium">{store.name}</TableCell>
                          <TableCell className="text-right text-sm">{itemCount} items</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit store">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Threshold PC</TableHead>
                      <TableHead className="text-right">Threshold CTN</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_ITEMS.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.type}</TableCell>
                        <TableCell className="text-right text-sm">{item.lowStockThresholdPc}</TableCell>
                        <TableCell className="text-right text-sm">{item.lowStockThresholdCtn}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit threshold">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
