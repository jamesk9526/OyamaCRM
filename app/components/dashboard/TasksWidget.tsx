"use client";

import Card from "@/app/components/ui/Card";
import { useState } from "react";

interface Task {
  id: string;
  title: string;
  organization: string;
  type: string;
  assignee: string;
  dueDate: string;
}

const SAMPLE_TASKS: Task[] = [
  {
    id: "1",
    title: "Thank you for annual gala support",
    organization: "Horizon Health Partners",
    type: "Phone",
    assignee: "Michael Chen",
    dueDate: "MAY 06",
  },
  {
    id: "2",
    title: "Receipt for recent donation",
    organization: "Urban Youth Initiative",
    type: "Mail",
    assignee: "Priya Patel",
    dueDate: "MAY 07",
  },
  {
    id: "3",
    title: "Follow-up on Q3 pledge",
    organization: "GreenTech Foundation",
    type: "Email",
    assignee: "Jessica Lin",
    dueDate: "MAY 08",
  },
  {
    id: "4",
    title: "Invitation to stewardship webinar",
    organization: "Arts for All",
    type: "Email",
    assignee: "Michael Chen",
    dueDate: "MAY 09",
  },
];

export default function TasksWidget() {
  const [filter, setFilter] = useState<"all" | "my">("all");

  const dueSoon = SAMPLE_TASKS.slice(0, 1);
  const dueLater = SAMPLE_TASKS.slice(1);

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          Tasks
          <span className="text-gray-400 text-sm">⏱️</span>
        </h3>
        <button className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            filter === "all"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          ALL
        </button>
        <button
          onClick={() => setFilter("my")}
          className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            filter === "my"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          MY
        </button>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Due soon */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Due Soon
          </h4>
          {dueSoon.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {/* Due later */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Due Later
          </h4>
          <div className="space-y-2">
            {dueLater.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="p-3 border border-gray-200 rounded-md hover:border-green-200 hover:bg-green-50/30 transition-colors group cursor-pointer">
      <div className="flex items-start justify-between mb-1">
        <h5 className="text-sm font-medium text-gray-900 group-hover:text-green-700">
          {task.title}
        </h5>
        <span className="text-xs text-gray-400 ml-2 shrink-0">{task.dueDate}</span>
      </div>
      <p className="text-sm text-gray-600 mb-1">{task.organization}</p>
      <p className="text-xs text-gray-500">{task.type}</p>
      <p className="text-xs text-gray-500">Assignee: {task.assignee}</p>
      <button className="text-green-600 hover:text-green-700 mt-2 text-xs font-medium">
        →
      </button>
    </div>
  );
}
