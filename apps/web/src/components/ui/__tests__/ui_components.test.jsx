import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

import { Button } from '../button';
import { Badge } from '../badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';
import { Input } from '../input';
import { Label } from '../label';
import { Textarea } from '../textarea';
import { Separator } from '../separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuGroup,
} from '../dropdown-menu';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../sheet';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../select';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../tooltip';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription, ToastClose, ToastAction } from '../toast';
import { Toaster } from '../toaster';
import { toast } from '../use-toast';

describe('UI Component Library Coverage', () => {
  it('renders Button variants and sizes', () => {
    const { rerender } = render(<Button variant="destructive" size="sm">Delete</Button>);
    expect(screen.getByText('Delete')).toBeInTheDocument();

    rerender(<Button variant="outline" size="lg">Outline</Button>);
    expect(screen.getByText('Outline')).toBeInTheDocument();

    rerender(<Button variant="ghost" size="icon">Ghost</Button>);
    expect(screen.getByText('Ghost')).toBeInTheDocument();
  });

  it('renders Badge variants', () => {
    const { rerender } = render(<Badge variant="critical">Critical</Badge>);
    expect(screen.getByText('Critical')).toBeInTheDocument();

    rerender(<Badge variant="high">High</Badge>);
    expect(screen.getByText('High')).toBeInTheDocument();

    rerender(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText('Secondary')).toBeInTheDocument();
  });

  it('renders Card components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content Area</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Content Area')).toBeInTheDocument();
  });

  it('renders form primitives: Input, Label, Textarea, Separator', () => {
    render(
      <div>
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" placeholder="test@test.com" />
        <Textarea placeholder="Bio" />
        <Separator />
      </div>
    );
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('test@test.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Bio')).toBeInTheDocument();
  });

  it('renders Tabs with active content', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Tab 1 Content</TabsContent>
        <TabsContent value="tab2">Tab 2 Content</TabsContent>
      </Tabs>
    );
    expect(screen.getByText('Tab 1 Content')).toBeInTheDocument();
  });

  it('renders Dialog, Sheet, and Dropdown primitives', () => {
    render(
      <div>
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Modal</DialogTitle>
              <DialogDescription>Dialog details</DialogDescription>
            </DialogHeader>
            <DialogFooter>Footer</DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Panel</SheetTitle>
              <SheetDescription>Sheet details</SheetDescription>
            </SheetHeader>
            <SheetFooter>Sheet Footer</SheetFooter>
          </SheetContent>
        </Sheet>

        <DropdownMenu defaultOpen open>
          <DropdownMenuTrigger asChild>
            <button>Menu</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent forceMount>
            <DropdownMenuGroup>
              <DropdownMenuLabel inset>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem inset>
                Profile <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem checked>Notifications</DropdownMenuCheckboxItem>
              <DropdownMenuRadioGroup value="dark">
                <DropdownMenuRadioItem value="dark">Dark Theme</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>

        <Select open defaultValue="val1">
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="val1">Option 1</SelectItem>
            <SelectItem value="val2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
    expect(screen.getByText('Dialog Modal')).toBeInTheDocument();
    expect(screen.getByText('Sheet Panel')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getAllByText('Option 1').length).toBeGreaterThan(0);
  });

  it('renders Tooltip, Toast, and Toaster', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button>Hover me</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
        <ToastProvider>
          <Toast open>
            <ToastTitle>Saved</ToastTitle>
            <ToastDescription>Success</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastProvider>
        <Toaster />
      </TooltipProvider>
    );
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();

    const t = toast({ title: 'Test', description: 'Desc' });
    t.update({ id: t.id, title: 'Updated' });
    t.dismiss();
  });
});
