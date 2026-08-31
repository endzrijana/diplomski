import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import logo from "./images/plane.png";

const instagramImages = import.meta.glob(
    "./images/*.png",
    {
        eager: true,
        import: "default",
    }
);
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const fallbackVectorLabels = {
    eco_conscious: "Eco conscious",
    luxury_orientation: "Luxury orientation",
    budget_orientation: "Budget orientation",
    adventure_orientation: "Adventure orientation",
    family_friendly: "Family friendly",
    authenticity_signal: "Authenticity",
};

const tabs = [
    { id: "matchmaking", label: "Matchmaking" },
    { id: "custom", label: "New Brand" },
    { id: "validation", label: "Evaluation" },
];

async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, options);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(body.detail || "API request failed.");
    }

    return body;
}

function humanize(value) {
    if (!value) return "—";

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFollowers(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = Number(value);

    if (number >= 1_000_000) {
        return `${(number / 1_000_000).toFixed(1)}M`;
    }

    if (number >= 1_000) {
        return `${(number / 1_000).toFixed(0)}K`;
    }

    return new Intl.NumberFormat("en-US").format(number);
}

function percent(value) {
    return `${(Number(value || 0) * 100).toFixed(0)}%`;
}

function getInstagramScreenshot(handle, index) {
    const cleanHandle = String(handle || "")
        .replace("@", "")
        .toLowerCase()
        .trim();

    const postNumber = index + 1;

    const expectedName = `${cleanHandle}_${postNumber}.png`;

    const match = Object.entries(instagramImages).find(
        ([path]) =>
            path.toLowerCase().endsWith(
                `/images/${expectedName}`.toLowerCase()
            )
    );

    return match ? match[1] : null;
}
function parseCaptions(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value.filter(Boolean).slice(0, 4);
    }

    const text = String(value).trim();

    if (!text) return [];

    try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
            return parsed.filter(Boolean).slice(0, 4);
        }
    } catch {
        // continue as text
    }

    return text
        .split(/\n{2,}|\|\||(?=\d+\.\s)/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4);
}

function getInitial(handle) {
    return String(handle || "?")
        .replace("@", "")
        .charAt(0)
        .toUpperCase();
}

function getPostImage(item, index) {
    const candidates = [
        item?.post_images?.[index],
        item?.thumbnail_urls?.[index],
        item?.thumbnail_url,
        item?.image_url,
        item?.profile_image,
    ];

    return candidates.find(Boolean) || null;
}

/* =========================================================
   NAVBAR
========================================================= */

function Navbar({ active, onChange }) {
    return (
        <header className="floating-nav">
            <button
                className="nav-brand"
                onClick={() => onChange("matchmaking")}
            >
                <div className="nav-logo-symbol">
                    <img
                        src={logo}
                        alt="TravelMatch"
                    />
                </div>

                <span className="nav-brand-text">TravelMatch</span>
            </button>

            <nav className="nav-menu">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`nav-item ${active === tab.id ? "active" : ""}`}
                        onClick={() => onChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            <button
                className="nav-cta"
                onClick={() => onChange("matchmaking")}
            >
                Find creators
            </button>
        </header>
    );
}

/* =========================================================
   HERO CONTENT
========================================================= */

function HeroContent({
    brands,
    brand,
    setBrand,
    loading,
    onSearch,
}) {
    return (
        <div className="hero-copy">
            <p className="hero-kicker">
                THE NEW WAY TO DISCOVER TRAVEL CREATORS
            </p>

            <h1>
                Find the right creators
                <br />
                for your travel brand
            </h1>

            <p className="hero-text">
                TravelMatch helps tourism brands discover and compare travel
                influencers based on semantic compatibility, content style and
                brand alignment.
            </p>

            <div className="hero-actions">
                <div className="hero-select-wrap">
                    <label>Select tourism brand</label>

                    <select
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                    >
                        {brands.map((item) => (
                            <option key={item.brand} value={item.brand}>
                                {item.brand}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    className="hero-main-button"
                    onClick={onSearch}
                    disabled={!brand || loading}
                >
                    {loading ? "Finding matches..." : "Find creators"}
                </button>
            </div>

            <div className="hero-mini-stats">
                <div>
                    <strong>Top 10</strong>
                    <span>recommendations</span>
                </div>

                <div>
                    <strong>6D</strong>
                    <span>brand alignment</span>
                </div>

                <div>
                    <strong>Hit@10</strong>
                    <span>evaluation</span>
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   HERO POSTS
========================================================= */

function parsePosts(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function HeroPosts({ selected }) {
    const realPosts = parsePosts(selected?.latest_posts);

    const captions = parseCaptions(
        selected?.latest_captions
    );

    const posts = realPosts.length
        ? realPosts
        : Array.from(
            { length: 5 },
            (_, index) => ({
                caption:
                    captions[
                    index %
                    Math.max(captions.length, 1)
                    ] ||
                    "Travel inspiration and authentic experiences.",

                image:
                    getPostImage(
                        selected,
                        index
                    ),

                platform:
                    selected?.platform === "youtube"
                        ? "YouTube"
                        : "Instagram"
            })
        );

    const indexedPosts = posts.map((post, index) => ({
        ...post,
        screenshotIndex: index,
    }));

    const loopPosts = [
        ...indexedPosts,
        ...indexedPosts,
    ];

    return (
        <div className="hero-posts-wrapper">

            <div className="moving-post-column">

                {loopPosts.map(
                    (post, index) => (
                        <HeroPostCard
                            key={`${post.post_url || post.video_id || "post"}-${index}`}
                            item={post}
                            selected={selected}
                            index={index}
                        />
                    )
                )}

            </div>

        </div>
    );
}

function HeroPostCard({ item, selected, index }) {
    const [playing, setPlaying] = useState(false);

    const platform = String(item?.platform || "").toLowerCase();
    const isYouTube = platform === "youtube";
    const isInstagram = platform === "instagram";

    if (isYouTube && item?.video_id) {
        return (
            <article className="moving-post-card">
                {playing ? (
                    <iframe
                        className="moving-post-video"
                        src={`https://www.youtube.com/embed/${item.video_id}?autoplay=1&rel=0`}
                        title={item.title || "YouTube video"}
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <>
                        {item?.thumbnail_url ? (
                            <img
                                src={item.thumbnail_url}
                                alt={item.title || "YouTube video"}
                                className="moving-post-image"
                            />
                        ) : (
                            <div className={`travel-placeholder placeholder-${index % 4}`}>
                                <span>
                                    {selected?.influencer_handle || "@travelcreator"}
                                </span>
                            </div>
                        )}

                        <button
                            type="button"
                            className="youtube-play-button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setPlaying(true);
                            }}
                            aria-label="Pusti YouTube video"
                        >
                            ▶
                        </button>

                        <div className="moving-post-gradient" />

                        <div className="moving-post-info">
                            <span className="moving-post-platform">YouTube</span>
                            <strong>
                                {selected?.influencer_handle || "@travelcreator"}
                            </strong>
                            <p>{item.title || item.caption}</p>
                        </div>
                    </>
                )}
            </article>
        );
    }

    if (isInstagram && item?.post_url) {
        const screenshot = getInstagramScreenshot(
            selected?.influencer_handle,
            item.screenshotIndex
        );

        return (
            <article className="moving-post-card instagram-card">
                <a
                    href={item.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="instagram-screenshot-link"
                >
                    {screenshot ? (
                        <img
                            src={screenshot}
                            alt={item.caption || "Instagram post"}
                            className="moving-post-image"
                            loading="lazy"
                        />
                    ) : (
                        <div className="travel-placeholder">
                            <span>
                                {selected?.influencer_handle || "@travelcreator"}
                            </span>
                        </div>
                    )}

                    <div className="moving-post-gradient" />

                    <div className="moving-post-info">
                        <span className="moving-post-platform">
                            Instagram
                        </span>

                        <strong>
                            {selected?.influencer_handle || "@travelcreator"}
                        </strong>

                        <p>
                            {item.caption}
                        </p>
                    </div>
                </a>
            </article>
        );
    }

    const fallbackImage =
        item?.image ||
        item?.thumbnail_url ||
        getPostImage(selected, index);

    return (
        <article className="moving-post-card">
            {fallbackImage ? (
                <img
                    src={fallbackImage}
                    alt={item?.caption || item?.title || "Travel post"}
                    className="moving-post-image"
                />
            ) : (
                <div className={`travel-placeholder placeholder-${index % 4}`}>
                    <span>
                        {selected?.influencer_handle || "@travelcreator"}
                    </span>
                </div>
            )}

            <div className="moving-post-gradient" />

            <div className="moving-post-info">
                <span className="moving-post-platform">
                    {item?.platform || selected?.platform || "Post"}
                </span>
                <strong>
                    {selected?.influencer_handle || "@travelcreator"}
                </strong>
                <p>{item?.caption || item?.title}</p>
            </div>
        </article>
    );
}


/* =========================================================
   FILTERS
========================================================= */

function FilterSidebar({
    platform,
    setPlatform,
    category,
    setCategory,
    filters,
    onApply,
}) {
    return (
        <aside className="filter-panel">
            <div className="filter-top">
                <h3>Filters</h3>

                <button
                    onClick={() => {
                        setPlatform("");
                        setCategory("");
                    }}
                >
                    Reset
                </button>
            </div>

            <div className="filter-block">
                <label>Platform</label>

                <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                >
                    <option value="">All platforms</option>

                    {filters.platforms.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-block">
                <label>Category</label>

                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="">All categories</option>

                    {filters.categories.map((item) => (
                        <option key={item} value={item}>
                            {humanize(item)}
                        </option>
                    ))}
                </select>
            </div>

            <button className="filter-button" onClick={onApply}>
                Apply filters
            </button>
        </aside>
    );
}

/* =========================================================
   CREATOR LIST
========================================================= */

function CreatorList({ results, selected, onSelect }) {
    return (
        <div className="creator-list-shell">
            <div className="creator-list-head">
                <div>
                    <p className="section-kicker">CREATOR DISCOVERY</p>
                    <h2>Recommended creators</h2>
                </div>

                <span>{results.length} results</span>
            </div>

            <div className="creator-list">
                {results.map((item) => (
                    <button
                        key={`${item.rank}-${item.influencer_handle}`}
                        className={`creator-row ${selected?.influencer_handle === item.influencer_handle
                            ? "selected"
                            : ""
                            }`}
                        onClick={() => onSelect(item)}
                    >
                        <span className="creator-rank">
                            {String(item.rank).padStart(2, "0")}
                        </span>

                        <div className="creator-avatar">
                            {item.profile_image ? (
                                <img src={item.profile_image} alt="" />
                            ) : (
                                getInitial(item.influencer_handle)
                            )}
                        </div>

                        <div className="creator-info">
                            <strong>{item.influencer_handle}</strong>

                            <span>
                                {item.platform || "—"} ·{" "}
                                {humanize(item.category_label)}
                            </span>
                        </div>

                        <div className="creator-small-stat">
                            <span>Followers</span>
                            <strong>{formatFollowers(item.followers)}</strong>
                        </div>

                        <div className="creator-small-stat">
                            <span>Sentiment</span>
                            <strong>
                                {item.sentiment_score != null
                                    ? Number(item.sentiment_score).toFixed(2)
                                    : "—"}
                            </strong>
                        </div>

                        <div className="creator-match">
                            <strong>{percent(item.similarity_score)}</strong>
                            <span>match</span>
                        </div>

                        <span className="creator-chevron">→</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* =========================================================
   CONTENT PANEL
========================================================= */

function ContentPanel({ selected }) {
    if (!selected) {
        return (
            <aside className="creator-content-panel">
                <p>Select a creator to view their content.</p>
            </aside>
        );
    }

    const captions = parseCaptions(selected.latest_captions);

    return (
        <aside className="creator-content-panel">
            <div className="selected-creator-head">
                <div className="creator-avatar large">
                    {selected.profile_image ? (
                        <img src={selected.profile_image} alt="" />
                    ) : (
                        getInitial(selected.influencer_handle)
                    )}
                </div>

                <div>
                    <strong>{selected.influencer_handle}</strong>
                    <span>
                        {selected.platform || "—"} ·{" "}
                        {humanize(selected.category_label)}
                    </span>
                </div>
            </div>

            <div className="selected-score-row">
                <div>
                    <span>Match</span>
                    <strong>{percent(selected.similarity_score)}</strong>
                </div>

                <div>
                    <span>Followers</span>
                    <strong>{formatFollowers(selected.followers)}</strong>
                </div>
            </div>

            <div className="content-panel-title">
                <h3>Recent content</h3>
            </div>

            <div className="side-post-list">
                {(captions.length ? captions : ["No recent captions available."])
                    .slice(0, 3)
                    .map((caption, index) => (
                        <article className="side-post" key={index}>
                            <div className="side-post-image">
                                {getPostImage(selected, index) ? (
                                    <img
                                        src={getPostImage(selected, index)}
                                        alt=""
                                    />
                                ) : (
                                    <span>{index}</span>
                                )}
                            </div>

                            <div>
                                <span className="side-post-platform">
                                    {selected.platform || "Travel"}
                                </span>

                                <p>{caption}</p>
                            </div>
                        </article>
                    ))}
            </div>
        </aside>
    );
}

/* =========================================================
   ALIGNMENT
========================================================= */

function AlignmentSection({ selected, brandVector, labels }) {
    if (!selected || !brandVector) return null;

    return (
        <section className="alignment-shell">
            <div className="alignment-title-row">
                <div>
                    <p className="section-kicker">WHY THIS MATCH</p>

                    <h2>
                        {selected.influencer_handle} and your brand
                    </h2>
                </div>

                <div className="alignment-big-score">
                    <strong>{percent(selected.similarity_score)}</strong>
                    <span>overall match</span>
                </div>
            </div>

            {selected.bio_text && (
                <p className="alignment-bio">{selected.bio_text}</p>
            )}

            <div className="alignment-grid">
                {Object.keys(brandVector).map((key) => {
                    const brandValue = Number(brandVector[key] || 0);
                    const influencerValue = Number(
                        selected.vector?.[key] || 0
                    );

                    return (
                        <div className="alignment-item" key={key}>
                            <div className="alignment-item-head">
                                <span>{labels[key] || humanize(key)}</span>

                                <span>
                                    {brandValue.toFixed(2)} /{" "}
                                    {influencerValue.toFixed(2)}
                                </span>
                            </div>

                            <div className="alignment-bar-wrap">
                                <div className="alignment-track">
                                    <div
                                        className="alignment-fill brand"
                                        style={{ width: `${brandValue * 100}%` }}
                                    />
                                </div>

                                <div className="alignment-track">
                                    <div
                                        className="alignment-fill influencer"
                                        style={{ width: `${influencerValue * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/* =========================================================
   MATCHMAKING PAGE
========================================================= */

function MatchmakingPage({ brands, filters, labels }) {
    const [brand, setBrand] = useState("");
    const [platform, setPlatform] = useState("");
    const [category, setCategory] = useState("");

    const [data, setData] = useState(null);
    const [selected, setSelected] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (brands.length && !brand) {
            setBrand(brands[0].brand);
        }
    }, [brands, brand]);

    async function runRecommendations() {
        if (!brand) return;

        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({
                brand,
                limit: "10",
            });

            if (platform) params.set("platform", platform);
            if (category) params.set("category", category);

            const result = await api(
                `/api/recommendations?${params.toString()}`
            );

            setData(result);
            setSelected(result.recommendations?.[0] || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (brand) {
            runRecommendations();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brand]);

    return (
        <>
            <section className="purple-hero">
                <div className="hero-inner">
                    <HeroContent
                        brands={brands}
                        brand={brand}
                        setBrand={setBrand}
                        loading={loading}
                        onSearch={runRecommendations}
                    />

                    <HeroPosts selected={selected} />
                </div>
            </section>

            {error && <div className="error-box">{error}</div>}

            {data && (
                <>
                    <section className="discovery-section">
                        <div className="discovery-layout">
                            <FilterSidebar
                                platform={platform}
                                setPlatform={setPlatform}
                                category={category}
                                setCategory={setCategory}
                                filters={filters}
                                onApply={runRecommendations}
                            />

                            <CreatorList
                                results={data.recommendations}
                                selected={selected}
                                onSelect={setSelected}
                            />

                            <ContentPanel selected={selected} />
                        </div>
                    </section>

                    <AlignmentSection
                        selected={selected}
                        brandVector={data.brand_vector}
                        labels={labels}
                    />
                </>
            )}
        </>
    );
}

/* =========================================================
   NEW BRAND PAGE
========================================================= */

function Slider({ label, value, onChange }) {
    return (
        <div className="custom-slider">
            <div className="custom-slider-head">
                <span>{label}</span>
                <strong>{value.toFixed(1)}</strong>
            </div>

            <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </div>
    );
}

function NewBrandPage({ labels }) {
    const keys = Object.keys(labels);

    const [name, setName] = useState("New Travel Brand");

    const [vector, setVector] = useState(
        Object.fromEntries(keys.map((key) => [key, 0.5]))
    );

    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function generate() {
        setLoading(true);
        setError("");

        try {
            const result = await api("/api/custom-recommendations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    limit: 10,
                    ...vector,
                }),
            });

            setResults(result.recommendations || []);
            setSelected(result.recommendations?.[0] || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="internal-page">
            <div className="internal-hero">
                <p className="hero-kicker">BUILD A BRAND PROFILE</p>

                <h1>Create your own travel brand profile</h1>

                <p>
                    Define your brand values and discover travel creators with the
                    strongest semantic alignment.
                </p>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="custom-brand-layout">
                <div className="custom-brand-form">
                    <label>Brand name</label>

                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <div className="custom-slider-list">
                        {keys.map((key) => (
                            <Slider
                                key={key}
                                label={labels[key]}
                                value={vector[key]}
                                onChange={(value) =>
                                    setVector((previous) => ({
                                        ...previous,
                                        [key]: value,
                                    }))
                                }
                            />
                        ))}
                    </div>

                    <button
                        className="hero-main-button dark"
                        onClick={generate}
                        disabled={loading}
                    >
                        {loading
                            ? "Generating recommendations..."
                            : "Generate recommendations"}
                    </button>
                </div>

                <CreatorList
                    results={results}
                    selected={selected}
                    onSelect={setSelected}
                />

                <ContentPanel selected={selected} />
            </div>

            <AlignmentSection
                selected={selected}
                brandVector={vector}
                labels={labels}
            />
        </section>
    );
}

/* =========================================================
   VALIDATION
========================================================= */

function EvaluationPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/api/validation")
            .then(setData)
            .catch((err) => setError(err.message));
    }, []);

    if (error) {
        return <div className="error-box">{error}</div>;
    }

    if (!data) {
        return <div className="loading-state">Loading evaluation...</div>;
    }

    return (
        <section className="internal-page">
            <div className="internal-hero">
                <p className="hero-kicker">MODEL EVALUATION</p>

                <h1>How well does TravelMatch perform?</h1>

                <p>
                    Evaluation of the recommendation model using confirmed
                    collaborations, brand mentions, Hit@10 and Mean Reciprocal Rank.
                </p>
            </div>

            <div className="evaluation-metrics">
                <MetricCard
                    title="Confirmed collaborations"
                    hit={data.confirmed.hit_at_10}
                    mrr={data.confirmed.mrr}
                />

                <MetricCard
                    title="Brand mentions"
                    hit={data.mentions.hit_at_10}
                    mrr={data.mentions.mrr}
                />

                <MetricCard
                    title="Overall"
                    hit={data.overall.hit_at_10}
                    mrr={data.overall.mrr}
                />
            </div>

            <div className="evaluation-table-wrap">
                <table className="evaluation-table">
                    <thead>
                        <tr>
                            <th>Brand</th>
                            <th>Influencer</th>
                            <th>Evidence</th>
                            <th>Rank</th>
                            <th>Similarity</th>
                            <th>Hit@10</th>
                        </tr>
                    </thead>

                    <tbody>
                        {data.details.map((row, index) => (
                            <tr
                                key={`${row.brand}-${row.influencer_handle}-${index}`}
                            >
                                <td>{row.brand}</td>
                                <td>{row.influencer_handle}</td>

                                <td>
                                    {row.evidence_type === "confirmed_collaboration"
                                        ? "Confirmed collaboration"
                                        : "Brand mention"}
                                </td>

                                <td>{row.predicted_rank ?? "—"}</td>

                                <td>
                                    {row.similarity_score != null
                                        ? percent(row.similarity_score)
                                        : "—"}
                                </td>

                                <td>
                                    <span
                                        className={`hit-label ${row.hit_at_10 ? "yes" : "no"
                                            }`}
                                    >
                                        {row.hit_at_10 ? "YES" : "NO"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function MetricCard({ title, hit, mrr }) {
    return (
        <div className="evaluation-card">
            <span>{title}</span>

            <strong>{percent(hit)}</strong>

            <p>Hit@10</p>

            <div className="evaluation-card-line" />

            <small>MRR {Number(mrr || 0).toFixed(3)}</small>
        </div>
    );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
    const [active, setActive] = useState("matchmaking");

    const [brands, setBrands] = useState([]);
    const [filters, setFilters] = useState({
        platforms: [],
        categories: [],
    });

    const [labels, setLabels] = useState(
        fallbackVectorLabels
    );

    const [bootError, setBootError] = useState("");

    useEffect(() => {
        Promise.all([
            api("/api/brands"),
            api("/api/filters"),
        ])
            .then(([brandData, filterData]) => {
                setBrands(brandData.brands || []);

                setFilters({
                    platforms: filterData.platforms || [],
                    categories: filterData.categories || [],
                });

                setLabels(
                    brandData.vector_labels || fallbackVectorLabels
                );
            })
            .catch((err) => setBootError(err.message));
    }, []);

    return (
        <div className="app-shell">
            <Navbar
                active={active}
                onChange={setActive}
            />

            {bootError ? (
                <div className="error-box app-error">
                    Backend unavailable: {bootError}
                </div>
            ) : (
                <>
                    {active === "matchmaking" && (
                        <MatchmakingPage
                            brands={brands}
                            filters={filters}
                            labels={labels}
                        />
                    )}

                    {active === "custom" && (
                        <NewBrandPage labels={labels} />
                    )}

                    {active === "validation" && (
                        <EvaluationPage />
                    )}
                </>
            )}
        </div>
    );
}