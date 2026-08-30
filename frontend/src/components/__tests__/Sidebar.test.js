import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "../Sidebar";

const files = [{ name: "lease.pdf" }, { name: "nda.pdf" }];

test("renders the file list", () => {
  render(<Sidebar files={files} onSelect={() => {}} />);

  expect(screen.getByText("lease.pdf")).toBeInTheDocument();
  expect(screen.getByText("nda.pdf")).toBeInTheDocument();
});

test("renders nothing in the list when there are no files", () => {
  render(<Sidebar files={[]} onSelect={() => {}} />);

  expect(screen.getByText("Files")).toBeInTheDocument();
  expect(screen.queryByText("lease.pdf")).not.toBeInTheDocument();
});

test("calls onSelect with the clicked file", async () => {
  const onSelect = jest.fn();
  render(<Sidebar files={files} onSelect={onSelect} />);

  await userEvent.click(screen.getByText("nda.pdf"));

  expect(onSelect).toHaveBeenCalledWith(files[1]);
});

test("shows upload progress while a file is uploading", () => {
  render(
    <Sidebar
      files={files}
      onSelect={() => {}}
      uploadStatus={{ "lease.pdf": { status: "uploading", progress: 42 } }}
    />
  );

  expect(screen.getByText("42%")).toBeInTheDocument();
});

test("shows each terminal status label", () => {
  render(
    <Sidebar
      files={[{ name: "a.pdf" }, { name: "b.pdf" }, { name: "c.pdf" }]}
      onSelect={() => {}}
      uploadStatus={{
        "a.pdf": { status: "processing" },
        "b.pdf": { status: "ready" },
        "c.pdf": { status: "error" },
      }}
    />
  );

  expect(screen.getByText("Processing...")).toBeInTheDocument();
  expect(screen.getByText("Ready")).toBeInTheDocument();
  expect(screen.getByText("Error")).toBeInTheDocument();
});

test("shows no badge for a file with no status", () => {
  render(<Sidebar files={files} onSelect={() => {}} uploadStatus={{}} />);

  expect(screen.queryByText("Ready")).not.toBeInTheDocument();
  expect(screen.queryByText("Processing...")).not.toBeInTheDocument();
});
