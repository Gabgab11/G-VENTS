"use client";

import { useState } from "react";
import { CalendarDays, Plus, Share2 } from "lucide-react";
import { Avatar, Badge, Banner, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Link, PageHeader, Select, Stat, TabLink, TabLinks, Table, Td, Textarea, Th } from "@/design";
import { Dialog, DialogClose, DialogContent, DialogTrigger, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Sheet, SheetContent, SheetTrigger, Switch, Tabs, TabsContent, TabsList, TabsTrigger, ToastProvider, Tooltip, useToast } from "@/design/client";
import { TOKENS } from "@/design/token-list";
import styles from "./style-guide.module.css";

type Theme = "dark" | "light";

export default function StyleGuide() {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  return (
    <ToastProvider>
      <PageHeader
        title="Style guide"
        subtitle="Every token and component, in both themes. Values live only in src/design/tokens.css."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setDir(dir === "ltr" ? "rtl" : "ltr")} aria-pressed={dir === "rtl"}>
            {dir === "ltr" ? "Show right to left" : "Show left to right"}
          </Button>
        }
      />
      <div className={styles.themes} dir={dir}>
        {(["dark", "light"] as Theme[]).map((theme) => (
          <section key={theme} data-theme={theme} className={styles.theme} aria-label={`${theme} theme`}>
            <h2 className={styles.themeName}>{theme === "dark" ? "Dark" : "Light"}</h2>
            <Tokens />
            <Components />
          </section>
        ))}
      </div>
    </ToastProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Tokens() {
  return (
    <>
      <Section title="Colour">
        <div className={styles.swatches}>
          {[...TOKENS.color, ...TOKENS.tone].map((name) => (
            <div key={name} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(--${name})` }} />
              <code>{name}</code>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Type">
        <div className={styles.typeList}>
          {TOKENS.type.map((name) => (
            <div key={name} className={styles.typeRow}>
              <code>{name}</code>
              <span
                style={{
                  fontSize: `var(--text-${name})`,
                  lineHeight: `var(--leading-${name})`,
                  fontFamily: ["display-xl", "display-lg", "heading-1", "logo"].includes(name) ? "var(--font-display)" : "var(--font-sans)",
                  fontWeight: ["display-xl", "display-lg", "heading-1", "logo", "heading-2", "stat"].includes(name) ? "var(--weight-heavy)" : undefined,
                }}
              >
                {name === "stat" ? "₦1,240,000" : name === "eyebrow" ? "SAT 14 DEC · 7 PM" : "Make it a night"}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Space">
        <div className={styles.scale}>
          {TOKENS.space.map((name) => (
            <div key={name} className={styles.scaleRow}><code>{name}</code><span className={styles.bar} style={{ inlineSize: `var(--${name})` }} /></div>
          ))}
        </div>
      </Section>
      <Section title="Radius and shadow">
        <div className={styles.shapes}>
          {TOKENS.radius.map((name) => (
            <div key={name} className={styles.shape} style={{ borderRadius: `var(--${name})` }}><code>{name}</code></div>
          ))}
          {TOKENS.shadow.map((name) => (
            <div key={name} className={styles.shape} style={{ boxShadow: `var(--${name})` }}><code>{name}</code></div>
          ))}
        </div>
      </Section>
    </>
  );
}

function Components() {
  const { toast } = useToast();
  const [on, setOn] = useState(true);
  return (
    <>
      <Section title="Button">
        <div className={styles.row}>
          <Button variant="primary">Create event</Button>
          <Button variant="accent">Get tickets</Button>
          <Button variant="secondary"><Share2 size={20} strokeWidth={1.75} aria-hidden />Share</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Cancel event</Button>
        </div>
        <div className={styles.row}>
          <Button variant="primary" size="sm"><Plus size={16} aria-hidden />New</Button>
          <Button size="lg" variant="primary">Register free</Button>
          <Button icon={<Share2 size={20} strokeWidth={1.75} aria-hidden />} aria-label="Share" />
          <Button variant="primary" loading>Saving…</Button>
          <Link href="/style-guide">A text link</Link>
        </div>
      </Section>
      <Section title="Badge">
        <div className={styles.row}>
          <Badge tone="success">Published</Badge><Badge>Draft</Badge><Badge tone="warning">Pending payout</Badge>
          <Badge tone="danger">Cancelled</Badge><Badge tone="info">Private</Badge><Badge tone="accent">Co-host</Badge>
          <Badge plain>Free</Badge><Badge verified>Verified host</Badge>
        </div>
      </Section>
      <Section title="Banner">
        <div className={styles.stack}>
          <Banner tone="info" title="Add a payout account" action={<Button size="sm">Add account</Button>}>Paid tickets go on sale once your bank account is verified.</Banner>
          <Banner tone="success" title="Event published">Your followers will get an email in the next few minutes.</Banner>
          <Banner tone="warning" title="Two days left">Early bird ends Friday at midnight, Lagos time.</Banner>
          <Banner tone="danger" title="Payment failed">Paystack declined the card. No money was taken.</Banner>
        </div>
      </Section>
      <Section title="Card, Stat, Table">
        <div className={styles.grid}>
          <Stat label="Tickets sold" value="412" delta={{ trend: "up", text: "18% vs previous 30 days" }} />
          <Stat label="Revenue" value="₦1.24M" delta={{ trend: "down", text: "4% vs previous 30 days" }} />
          <Stat label="Checked in" value="87%" context="of 356 guests" />
        </div>
        <Card>
          <CardHeader title="Recent orders" headingLevel={4} action={<Link href="/style-guide">View all</Link>} />
          <Table caption="Recent orders">
            <thead><tr><Th>Guest</Th><Th>Tickets</Th><Th numeric>Amount</Th></tr></thead>
            <tbody>
              <tr><Td label="Guest">Ada O.</Td><Td label="Tickets">2 × General</Td><Td label="Amount" numeric>₦10,000</Td></tr>
              <tr><Td label="Guest">Tunde B.</Td><Td label="Tickets">1 × VIP</Td><Td label="Amount" numeric>₦25,000</Td></tr>
            </tbody>
          </Table>
        </Card>
      </Section>
      <Section title="Field">
        <div className={styles.stack}>
          <Field label="Event name"><Input defaultValue="Lagos Jazz Brunch" /></Field>
          <Field label="Handle" error="Use 3 to 30 letters, numbers or dashes."><Input defaultValue="ad" /></Field>
          <Field label="Description" hint="Shown on the event page and in the share preview."><Textarea placeholder="What should guests know?" /></Field>
          <Field label="Category"><Select defaultValue="music"><option value="music">Music</option><option value="food">Food</option></Select></Field>
          <Checkbox label="Show remaining tickets" defaultChecked />
          <div className={styles.row}><Switch checked={on} onCheckedChange={setOn} aria-label="Private event" /> Private event</div>
        </div>
      </Section>
      <Section title="Tabs">
        <TabLinks aria-label="Event sections">
          <TabLink href="/style-guide" active>Overview</TabLink>
          <TabLink href="/style-guide" count={356}>Guests</TabLink>
          <TabLink href="/style-guide">Tickets</TabLink>
        </TabLinks>
        <Tabs defaultValue="upcoming">
          <TabsList aria-label="Events"><TabsTrigger value="upcoming" count={3}>Upcoming</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger></TabsList>
          <TabsContent value="upcoming"><p className={styles.muted}>Three upcoming events.</p></TabsContent>
          <TabsContent value="past"><p className={styles.muted}>No past events.</p></TabsContent>
        </Tabs>
      </Section>
      <Section title="Overlays">
        <div className={styles.row}>
          <Menu>
            <MenuTrigger><Button>Menu</Button></MenuTrigger>
            <MenuContent><MenuLabel>Event</MenuLabel><MenuItem>Edit</MenuItem><MenuItem>Duplicate</MenuItem><MenuSeparator /><MenuItem danger>Cancel event</MenuItem></MenuContent>
          </Menu>
          <Dialog>
            <DialogTrigger><Button>Dialog</Button></DialogTrigger>
            <DialogContent title="Cancel this event?" description="Guests get an email. This can't be undone." footer={<><DialogClose><Button variant="ghost">Keep it</Button></DialogClose><Button variant="danger">Cancel event</Button></>}>
              <p className={styles.muted}>Paid orders are refunded in full.</p>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger><Button>Sheet</Button></SheetTrigger>
            <SheetContent title="Share this event"><p className={styles.muted}>On phones this opens from the bottom.</p></SheetContent>
          </Sheet>
          <Popover>
            <PopoverTrigger><Button>Popover</Button></PopoverTrigger>
            <PopoverContent><p className={styles.muted}>Popover content.</p></PopoverContent>
          </Popover>
          <Tooltip content="Copies the event link"><Button>Tooltip</Button></Tooltip>
          <Button onClick={() => toast({ title: "Link copied", tone: "success" })}>Toast</Button>
        </div>
      </Section>
      <Section title="Avatar and empty state">
        <div className={styles.row}><Avatar name="Ada Okafor" size={28} /><Avatar name="Ada Okafor" /><Avatar name="Tunde Bello" size={48} /></div>
        <EmptyState icon={<CalendarDays size={24} aria-hidden />} title="No events yet" headingLevel={4} action={<Button variant="primary">Create event</Button>}>
          Create your first event. It takes about two minutes, and tickets can be free.
        </EmptyState>
      </Section>
    </>
  );
}
