import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MessageSquare, FileText } from "lucide-react";

export default function HelpSupport() {
  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground mt-2">
          We're here to help. Find answers to common questions or reach out to our team.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Contact & Resources */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Contact Us</CardTitle>
              <CardDescription>Our support team is available 24/7</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Phone Support</p>
                  <p className="text-muted-foreground">+91 1800-123-4567</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Email Support</p>
                  <p className="text-muted-foreground">support@accountingapp.in</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-primary/10 p-2 rounded-full">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Live Chat</p>
                  <p className="text-muted-foreground">Available in dashboard</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                User Guide
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                API Documentation
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Video Tutorials
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: FAQs and Support Form */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Frequently Asked Questions</CardTitle>
              <CardDescription>Quick answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I file my GST Returns?</AccordionTrigger>
                  <AccordionContent>
                    Go to the GST Report section in the sidebar. You can view your GSTR-1, GSTR-2B, and GSTR-3B summaries there. Currently, you will need to export these and file them on the GST portal manually.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Can I add multiple companies?</AccordionTrigger>
                  <AccordionContent>
                    The multi-company feature is currently under development. In the future, you will be able to manage multiple businesses under a single account.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>How is my data backed up?</AccordionTrigger>
                  <AccordionContent>
                    Your data is securely backed up on our cloud servers daily. You can also manually export your data via the Utility section at any time.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I manage user permissions?</AccordionTrigger>
                  <AccordionContent>
                    Navigate to Settings &gt; Users & Roles to add new staff members and assign specific viewing or editing permissions to them.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Send us a message</CardTitle>
              <CardDescription>Fill out the form below and we'll get back to you shortly.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert("Message sent!"); }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="john@example.com" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="How can we help?" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" placeholder="Please describe your issue..." className="min-h-[120px]" required />
                </div>
                <Button type="submit">Submit Request</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
