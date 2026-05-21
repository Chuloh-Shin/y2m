import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InputScreen } from "./InputScreen";

describe("InputScreen", () => {
  it("renders the URL field and 변환 button", () => {
    render(<InputScreen onSubmitUrl={vi.fn()} disabled={false} />);
    expect(screen.getByLabelText(/YouTube 영상 URL/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /변환/ })).toBeInTheDocument();
  });

  it("disables 변환 when URL is empty", () => {
    render(<InputScreen onSubmitUrl={vi.fn()} disabled={false} />);
    expect(screen.getByRole("button", { name: /변환/ })).toBeDisabled();
  });

  it("enables 변환 when a plausible URL is typed", async () => {
    const user = userEvent.setup();
    render(<InputScreen onSubmitUrl={vi.fn()} disabled={false} />);
    await user.type(
      screen.getByLabelText(/YouTube 영상 URL/),
      "https://www.youtube.com/watch?v=abc",
    );
    expect(screen.getByRole("button", { name: /변환/ })).toBeEnabled();
  });

  it("calls onSubmitUrl with the trimmed url on submit", async () => {
    const user = userEvent.setup();
    const onSubmitUrl = vi.fn().mockResolvedValue(undefined);
    render(<InputScreen onSubmitUrl={onSubmitUrl} disabled={false} />);
    await user.type(
      screen.getByLabelText(/YouTube 영상 URL/),
      "https://www.youtube.com/watch?v=abc",
    );
    await user.click(screen.getByRole("button", { name: /변환/ }));
    expect(onSubmitUrl).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abc");
  });

  it("disables all controls when disabled=true (e.g. another job running)", () => {
    render(<InputScreen onSubmitUrl={vi.fn()} disabled={true} />);
    expect(screen.getByLabelText(/YouTube 영상 URL/)).toBeDisabled();
    expect(screen.getByRole("button", { name: /변환/ })).toBeDisabled();
  });
});
