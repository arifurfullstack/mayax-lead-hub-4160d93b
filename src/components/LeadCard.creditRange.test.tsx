import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LeadCard } from "./LeadCard";

const baseLead = {
  first_name: "Jane",
  last_name: "***",
  email: "xxx@xxxx.com",
  phone: "5555550123",
  price: 100,
  documents: [],
  quality_grade: "b",
};

function renderCard(extra: Record<string, unknown>) {
  return render(
    <TooltipProvider>
      <LeadCard
        lead={{ ...baseLead, ...extra }}
        locked={false}
        unlockAt={0}
        onBuy={() => {}}
      />
    </TooltipProvider>
  );
}

describe("LeadCard credit range", () => {
  it("renders normalized range when min/max are swapped", () => {
    renderCard({ credit_range_min: 800, credit_range_max: 600 });
    expect(screen.getByText("Credit 600-800")).toBeInTheDocument();
    expect(
      screen.getByText("Self-reported credit range: 600-800")
    ).toBeInTheDocument();
  });

  it("does not render credit range when values are null", () => {
    renderCard({ credit_range_min: null, credit_range_max: null });
    expect(screen.queryByText(/^Credit /)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Self-reported credit range/)
    ).not.toBeInTheDocument();
  });

  it("does not render when only one bound is provided", () => {
    renderCard({ credit_range_min: 600, credit_range_max: null });
    expect(screen.queryByText(/^Credit /)).not.toBeInTheDocument();
  });

  it("handles string numeric values correctly", () => {
    renderCard({ credit_range_min: "750", credit_range_max: "550" });
    expect(screen.getByText("Credit 550-750")).toBeInTheDocument();
    expect(
      screen.getByText("Self-reported credit range: 550-750")
    ).toBeInTheDocument();
  });
});