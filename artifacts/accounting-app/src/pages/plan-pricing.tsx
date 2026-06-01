import { useState } from "react";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const tiers = [
  {
    name: "Starter",
    id: "tier-starter",
    href: "#",
    priceMonthly: "₹999",
    priceAnnually: "₹9,999",
    description: "Perfect for small businesses just getting started with basic accounting.",
    features: [
      "Up to 500 invoices/month",
      "Basic reporting (Profit & Loss)",
      "Single user access",
      "Email support",
      "Standard templates",
    ],
    featured: false,
  },
  {
    name: "Professional",
    id: "tier-professional",
    href: "#",
    priceMonthly: "₹1,999",
    priceAnnually: "₹19,999",
    description: "Ideal for growing businesses needing inventory and GST compliance.",
    features: [
      "Unlimited invoices",
      "Full inventory management",
      "Up to 5 users",
      "Priority 24/7 support",
      "GST Return Reports (GSTR-1, 2B, 3B)",
      "Custom invoice branding",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    id: "tier-enterprise",
    href: "#",
    priceMonthly: "₹4,999",
    priceAnnually: "₹49,999",
    description: "Advanced features for large scale operations and multi-branch setups.",
    features: [
      "Everything in Professional",
      "Unlimited users & roles",
      "Dedicated account manager",
      "Multi-company support (Coming Soon)",
      "API access",
      "Custom integrations",
    ],
    featured: false,
  },
];

export default function PlanPricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8 max-w-7xl">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Choose the perfect plan for your business needs. No hidden fees.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Label htmlFor="billing-toggle" className={`text-sm ${!annual ? 'font-bold' : 'text-muted-foreground'}`}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={annual}
            onCheckedChange={setAnnual}
          />
          <Label htmlFor="billing-toggle" className={`text-sm ${annual ? 'font-bold' : 'text-muted-foreground'}`}>
            Annually <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary ml-1">Save 20%</span>
          </Label>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-start max-w-6xl mx-auto">
        {tiers.map((tier) => (
          <Card 
            key={tier.id} 
            className={`relative flex flex-col h-full transition-all duration-200 hover:shadow-lg ${
              tier.featured 
                ? 'border-primary shadow-md scale-105 z-10' 
                : 'border-border/50 bg-card/50'
            }`}
          >
            {tier.featured && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="flex items-center bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  <Zap className="w-3 h-3 mr-1" /> Most Popular
                </span>
              </div>
            )}
            
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
              <CardDescription className="min-h-[40px] mt-2">{tier.description}</CardDescription>
              <div className="mt-4 flex items-baseline text-5xl font-extrabold">
                {annual ? tier.priceAnnually : tier.priceMonthly}
                <span className="ml-1 text-xl font-medium text-muted-foreground">
                  /{annual ? 'yr' : 'mo'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-4">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <p className="ml-3 text-sm text-muted-foreground">{feature}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant={tier.featured ? "default" : "outline"} 
                className="w-full font-semibold"
                size="lg"
              >
                {tier.featured ? 'Get Started' : 'Choose Plan'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
