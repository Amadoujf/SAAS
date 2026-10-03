import { IconCheck } from "@/components/yc/icons";

export function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p role="alert" className="mt-3 rounded-xl bg-yc-danger/[0.07] px-3 py-2 text-sm font-medium text-[rgb(185_28_28)]">{error}</p>;
  if (success)
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-[rgb(4_120_87)]">
        <span className="yc-pop grid h-5 w-5 place-items-center rounded-full bg-yc-success text-white"><IconCheck size={13} /></span>
        {success}
      </p>
    );
  return null;
}
