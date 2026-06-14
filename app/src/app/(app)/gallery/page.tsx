"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Grid,
  Filter,
  ArrowUpDown,
  Search,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Star,
  Activity,
  X,
  Hexagon
} from "lucide-react";
import { toast } from "sonner";

interface PublicBuild {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  customPayloadWeightGrams: number;
  averageRating: number | null;
  ratingCount: number;
  auw: number;
  twr: number;
  propDiameter: number;
  createdAt: string;
  imageUrl?: string | null;
}

export default function GalleryPage() {
  const router = useRouter();

  // Search/Filters states
  const [category, setCategory] = useState(""); // freestyle, cinematic, racing, longrange, indoor
  const [weightClass, setWeightClass] = useState(""); // sub-250, 250-500, 500plus
  const [frameSize, setFrameSize] = useState(""); // 2, 3, 5, 7
  const [sort, setSort] = useState("newest"); // newest, popular, highest-rated, lightest, highest-twr
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalBuilds, setTotalBuilds] = useState(0);

  const [builds, setBuilds] = useState<PublicBuild[]>([]);
  const [loading, setLoading] = useState(true);

  // Compare tray state
  const [selectedForCompare, setSelectedForCompare] = useState<PublicBuild[]>([]);

  const fetchPublicBuilds = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (weightClass) params.append("weightClass", weightClass);
      if (frameSize) params.append("frameSize", frameSize);
      if (sort) params.append("sort", sort);
      if (search) params.append("search", search);
      params.append("page", page.toString());
      params.append("limit", "12");

      const res = await fetch(`/api/v1/builds/public?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch public builds");
      const body = await res.json();
      setBuilds(body.data || []);
      setTotalBuilds(body.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load public builds gallery.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicBuilds();
  }, [category, weightClass, frameSize, sort, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPublicBuilds();
  };

  // Clone Build
  const handleCloneBuild = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.promise(
      fetch(`/api/v1/builds/${id}/clone`, { method: "POST" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to clone");
          const body = await res.json();
          return body.build;
        }),
      {
        loading: "Cloning build to your hangar...",
        success: (cloned) => {
          router.push(`/dashboard?id=${cloned.id}`);
          return `Build cloned! Telemetry link active on hangar.`;
        },
        error: "Error duplicating configuration.",
      }
    );
  };

  // Handle compare selection
  const handleToggleCompare = (build: PublicBuild, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForCompare((prev) => {
      const exists = prev.some((b) => b.id === build.id);
      if (exists) {
        return prev.filter((b) => b.id !== build.id);
      } else {
        if (prev.length >= 4) {
          toast.warning("Comparison limit reached. Maximum 4 builds.");
          return prev;
        }
        return [...prev, build];
      }
    });
  };

  const handleLaunchCompare = () => {
    if (selectedForCompare.length < 2) {
      toast.error("Please select at least 2 builds for matrix comparison.");
      return;
    }
    const idsStr = selectedForCompare.map((b) => b.id).join(",");
    router.push(`/compare?ids=${idsStr}`);
  };

  return (
    <div className="min-h-screen p-6 select-none max-w-7xl mx-auto flex flex-col gap-6 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900 pb-5 gap-4">
        <div>
          <h1 className="text-xl font-black tracking-wider uppercase text-white flex items-center gap-2">
            <Grid className="w-5 h-5 text-cyan-400" />
            Public Hangar Gallery
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Clone, rate, and compare custom configurations from FPV pilots worldwide
          </p>
        </div>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search builds..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/20 border border-slate-900 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
          />
        </form>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-900/10 p-4 border border-slate-900 rounded-2xl">
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Category Chips */}
          <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mr-1">
            Category
          </span>
          {["freestyle", "cinematic", "racing", "longrange", "indoor"].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(category === cat ? "" : cat);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition cursor-pointer ${
                category === cat
                  ? "bg-cyan-950/40 border-cyan-800 text-cyan-400"
                  : "bg-slate-950/40 border-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filters Selects */}
        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto mt-3 lg:mt-0">
          {/* Weight Filter */}
          <select
            value={weightClass}
            onChange={(e) => {
              setWeightClass(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950/60 border border-slate-900 hover:border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
          >
            <option value="">All Weight Classes</option>
            <option value="sub-250">Sub-250g (Micro)</option>
            <option value="250-500">250g - 500g (Midweight)</option>
            <option value="500plus">500g+ (Heavy)</option>
          </select>

          {/* Size Filter */}
          <select
            value={frameSize}
            onChange={(e) => {
              setFrameSize(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950/60 border border-slate-900 hover:border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
          >
            <option value="">All Prop Sizes</option>
            <option value="2">2" or smaller</option>
            <option value="3">3" - 4"</option>
            <option value="5">5" - 6"</option>
            <option value="7">7" or larger</option>
          </select>

          {/* Sort Select */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950/60 border border-slate-900 hover:border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
          >
            <option value="newest">Newest Uploads</option>
            <option value="popular">Most Popular</option>
            <option value="highest-rated">Highest Rated</option>
            <option value="lightest">Lightest AUW</option>
            <option value="highest-twr">Highest TWR</option>
          </select>
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-44 text-slate-500">
          <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs font-bold uppercase tracking-widest">Scanning telemetry gallery...</span>
        </div>
      ) : builds.length === 0 ? (
        <div className="text-center py-32 border border-dashed border-slate-850 rounded-3xl text-slate-500 text-xs">
          No public configurations matching current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {builds.map((build) => {
            const isComparing = selectedForCompare.some((b) => b.id === build.id);
            return (
              <div
                key={build.id}
                onClick={() => router.push(`/builds/${build.id}`)}
                className="p-5 bg-slate-900/20 hover:bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl shadow-xl transition cursor-pointer flex flex-col justify-between h-[218px] group relative overflow-hidden"
              >
                <div className="flex gap-4 items-start">
                  {/* Thumbnail Image */}
                  <div className="shrink-0 w-16 h-16 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center overflow-hidden">
                    {build.imageUrl ? (
                      <img src={build.imageUrl} alt={build.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-700">
                        <Hexagon className="w-6 h-6 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs font-black text-white group-hover:text-cyan-400 transition truncate pr-4 uppercase tracking-wider">
                        {build.name}
                      </h3>
                      
                      {/* Compare Selection Checkbox */}
                      <button
                        onClick={(e) => handleToggleCompare(build, e)}
                        className={`p-1.5 border rounded-lg transition shrink-0 cursor-pointer ${
                          isComparing
                            ? "bg-cyan-950/60 border-cyan-800 text-cyan-400"
                            : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-white"
                        }`}
                        title="Add to Comparison Deck"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed font-medium">
                      {build.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div>
                  {/* Telemetry specs badges */}
                  <div className="grid grid-cols-2 gap-2 mt-2 py-2 border-t border-b border-slate-900/60 text-[10px]">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">AUW Weight</span>
                      <span className="text-slate-300 font-bold">{(build.auw || 0).toFixed(1)}g</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Thrust Ratio</span>
                      <span className="text-cyan-400 font-bold">{(build.twr || 0).toFixed(2)}:1</span>
                    </div>
                  </div>

                  {/* Rating, Date and actions */}
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-1">
                      <Star className={`w-3.5 h-3.5 fill-amber-500 text-amber-500 ${build.averageRating ? "" : "opacity-35"}`} />
                      <span className="text-[10px] font-bold text-slate-300">
                        {build.averageRating ? build.averageRating.toFixed(1) : "—"}
                      </span>
                      <span className="text-[9px] text-slate-500">({build.ratingCount})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleCloneBuild(build.id, e)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-950 transition cursor-pointer"
                        title="Clone Build"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/builds/${build.id}`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-950 transition cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {totalBuilds > 12 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 border border-slate-900 hover:border-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Page {page} of {Math.ceil(totalBuilds / 12)}
          </span>
          <button
            disabled={page >= Math.ceil(totalBuilds / 12)}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 border border-slate-900 hover:border-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating compare tray at bottom */}
      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 backdrop-blur-md border border-slate-900 shadow-2xl p-4 px-6 rounded-2xl flex items-center gap-6 max-w-lg w-full animate-slide-up">
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1">
              <GitCompare className="w-3.5 h-3.5" />
              Comparison Tray
            </span>
            <p className="text-[10px] text-slate-300 font-semibold truncate mt-0.5">
              {selectedForCompare.map((b) => b.name).join(" vs ")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedForCompare([])}
              className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={handleLaunchCompare}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/10 transition cursor-pointer"
            >
              Compare ({selectedForCompare.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
