"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchCodeFormProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export function SearchCodeForm({ onSearch, loading }: SearchCodeFormProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Es. MAV5160A, 01-0002C, F032US0057..."
        className="flex-1 h-11 text-base"
        autoFocus
        disabled={loading}
      />
      <Button type="submit" size="lg" className="h-11 px-6" disabled={loading || !value.trim()}>
        <Search className="mr-2 h-4 w-4" />
        Cerca
      </Button>
    </form>
  );
}
