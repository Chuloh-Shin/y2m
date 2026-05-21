import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InputScreen } from "./InputScreen";

type Override = Partial<React.ComponentProps<typeof InputScreen>>;

function renderInput(over: Override = {}) {
  const props: React.ComponentProps<typeof InputScreen> = {
    query: "",
    count: 10,
    onQueryChange: vi.fn(),
    onCountChange: vi.fn(),
    onGenerateList: vi.fn().mockResolvedValue(undefined),
    onSubmitUrl: vi.fn().mockResolvedValue(undefined),
    disabled: false,
    generating: false,
    errorMessage: undefined,
    ...over,
  };
  return { ...render(<InputScreen {...props} />), props };
}

describe("InputScreen", () => {
  describe("URL mode (Task 2)", () => {
    it("renders the URL field and 변환 button", () => {
      renderInput();
      expect(screen.getByLabelText(/YouTube 영상 URL/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /변환/ })).toBeInTheDocument();
    });

    it("disables 변환 when URL is empty", () => {
      renderInput();
      expect(screen.getByRole("button", { name: /변환/ })).toBeDisabled();
    });

    it("enables 변환 when a plausible URL is typed", async () => {
      const user = userEvent.setup();
      renderInput();
      await user.type(
        screen.getByLabelText(/YouTube 영상 URL/),
        "https://www.youtube.com/watch?v=abc",
      );
      expect(screen.getByRole("button", { name: /변환/ })).toBeEnabled();
    });

    it("calls onSubmitUrl with the trimmed url on submit", async () => {
      const user = userEvent.setup();
      const { props } = renderInput();
      await user.type(
        screen.getByLabelText(/YouTube 영상 URL/),
        "https://www.youtube.com/watch?v=abc",
      );
      await user.click(screen.getByRole("button", { name: /변환/ }));
      expect(props.onSubmitUrl).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=abc",
      );
    });
  });

  describe("Taste mode (Task 3)", () => {
    it("renders the taste textbox, count input, and 곡 목록 만들기 button", () => {
      renderInput();
      expect(screen.getByLabelText(/어떤 곡을 듣고 싶으세요/)).toBeInTheDocument();
      expect(screen.getByLabelText(/곡 수/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /곡 목록 만들기/ })).toBeInTheDocument();
    });

    it("defaults count to 10", () => {
      renderInput();
      expect(screen.getByLabelText(/곡 수/)).toHaveValue(10);
    });

    it("disables 곡 목록 만들기 when query is empty", () => {
      renderInput({ query: "" });
      expect(screen.getByRole("button", { name: /곡 목록 만들기/ })).toBeDisabled();
    });

    it("enables 곡 목록 만들기 when query has text", () => {
      renderInput({ query: "댄스곡" });
      expect(screen.getByRole("button", { name: /곡 목록 만들기/ })).toBeEnabled();
    });

    it("calls onGenerateList when 곡 목록 만들기 is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderInput({ query: "댄스곡" });
      await user.click(screen.getByRole("button", { name: /곡 목록 만들기/ }));
      expect(props.onGenerateList).toHaveBeenCalled();
    });

    it("clamps count to 1 when 0 is entered", () => {
      const { props } = renderInput();
      fireEvent.change(screen.getByLabelText(/곡 수/), { target: { value: "0" } });
      expect(props.onCountChange).toHaveBeenLastCalledWith(1);
    });

    it("clamps count to 50 when 51 is entered", () => {
      const { props } = renderInput();
      fireEvent.change(screen.getByLabelText(/곡 수/), { target: { value: "51" } });
      expect(props.onCountChange).toHaveBeenLastCalledWith(50);
    });
  });

  describe("Error state (Task 3)", () => {
    it("shows the error message in an alert when errorMessage is set", () => {
      renderInput({ query: "댄스곡", errorMessage: "LLM 호출이 실패했습니다." });
      expect(screen.getByText(/LLM 호출이 실패했습니다/)).toBeInTheDocument();
    });

    it("changes button label to '다시 시도' on error", () => {
      renderInput({ query: "댄스곡", errorMessage: "LLM 호출이 실패했습니다." });
      expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^곡 목록 만들기$/ }),
      ).not.toBeInTheDocument();
    });

    it("preserves query and count when errorMessage is set", () => {
      renderInput({ query: "댄스곡", count: 7, errorMessage: "x" });
      expect(screen.getByLabelText(/어떤 곡을 듣고 싶으세요/)).toHaveValue("댄스곡");
      expect(screen.getByLabelText(/곡 수/)).toHaveValue(7);
    });
  });

  describe("Concurrency (Task 3)", () => {
    it("disables both submit buttons while generating=true", () => {
      renderInput({ query: "댄스곡", generating: true });
      expect(screen.getByRole("button", { name: /곡 목록 만들기|다시 시도/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /변환/ })).toBeDisabled();
    });

    it("disables all controls when disabled=true", () => {
      renderInput({ disabled: true });
      expect(screen.getByLabelText(/YouTube 영상 URL/)).toBeDisabled();
      expect(screen.getByLabelText(/어떤 곡을 듣고 싶으세요/)).toBeDisabled();
      expect(screen.getByRole("button", { name: /변환/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /곡 목록 만들기/ })).toBeDisabled();
    });
  });
});
