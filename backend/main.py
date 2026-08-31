from pathlib import Path
import json
from typing import Optional

import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from sklearn.metrics.pairwise import cosine_similarity


# =======================================================
# PUTANJE DO PODATAKA
# =======================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

INFLUENCERS_CSV = DATA_DIR / "combined_enriched.csv"
BRANDS_CSV = DATA_DIR / "brand_vectors.csv"
VALIDATION_CSV = DATA_DIR / "validation_set.csv"


# =======================================================
# VEKTORSKE DIMENZIJE
# =======================================================

VECTOR_KEYS = [
    "eco_conscious",
    "luxury_orientation",
    "budget_orientation",
    "adventure_orientation",
    "family_friendly",
    "authenticity_signal",
]


VECTOR_LABELS = {
    "eco_conscious": "Eco conscious",
    "luxury_orientation": "Luxury",
    "budget_orientation": "Budget",
    "adventure_orientation": "Adventure",
    "family_friendly": "Family friendly",
    "authenticity_signal": "Authenticity",
}


# =======================================================
# REDOSLED BRENDOVA U DROPDOWN-U
# =======================================================

BRAND_ORDER = [
    "Turkish Airlines",
    "Norwegian Air",
    "Etihad Airways",
    "Emirates",
    "Qatar Airways",
    "Wizz Air",
    "Air France",
    "British Airways",
    "Lufthansa",
    "Eurowings",

    "Aman Resorts",
    "Ibis / Accor",
    "Booking.com",
    "Airbnb",
    "Hostelworld",
    "Marriott",
    "Hilton",
    "Four Seasons",
    "Selina",
    "Habitas",
]


# =======================================================
# POMOĆNE FUNKCIJE
# =======================================================

def normalize_handle(value: str) -> str:

    return (
        str(value)
        .lower()
        .strip()
        .lstrip("@")
        .replace(" ", "")
    )


def safe_json(value, fallback):

    if isinstance(value, dict):
        return value

    if pd.isna(value):
        return fallback

    try:

        parsed = json.loads(
            str(value)
        )

        return (
            parsed
            if isinstance(parsed, dict)
            else fallback
        )

    except (
        json.JSONDecodeError,
        TypeError
    ):

        return fallback


def safe_json_list(value):

    if isinstance(value, list):
        return value

    if pd.isna(value):
        return []

    try:

        parsed = json.loads(
            str(value)
        )

        return (
            parsed
            if isinstance(parsed, list)
            else []
        )

    except (
        json.JSONDecodeError,
        TypeError
    ):

        return []


# =======================================================
# UČITAVANJE PODATAKA
# =======================================================

def load_data():

    # ---------------------------------------------------
    # PROVERA POSTOJANJA FAJLOVA
    # ---------------------------------------------------

    if not INFLUENCERS_CSV.exists():

        raise FileNotFoundError(
            f"Nije pronađen fajl: {INFLUENCERS_CSV}"
        )

    if not BRANDS_CSV.exists():

        raise FileNotFoundError(
            f"Nije pronađen fajl: {BRANDS_CSV}"
        )

    # ---------------------------------------------------
    # UČITAVANJE CSV FAJLOVA
    # ---------------------------------------------------

    influencers = pd.read_csv(
        INFLUENCERS_CSV
    )

    brands = pd.read_csv(
        BRANDS_CSV
    )

    # ---------------------------------------------------
    # GENUINE TRAVEL INFLUENCERS
    # ---------------------------------------------------

    genuine = (
        influencers[
            "is_genuine_travel_influencer"
        ]
        .astype(str)
        .str.lower()
        .map({
            "true": True,
            "false": False
        })
        .fillna(False)
    )

    influencers = influencers[
        genuine
    ].copy()

    # ---------------------------------------------------
    # UKLANJANJE REDOVA BEZ VEKTORA
    # ---------------------------------------------------

    influencers = influencers.dropna(
        subset=[
            "brand_alignment_vector"
        ]
    ).copy()

    # ---------------------------------------------------
    # NORMALIZACIJA HANDLE-A
    # ---------------------------------------------------

    influencers[
        "handle_normalized"
    ] = influencers[
        "influencer_handle"
    ].apply(
        normalize_handle
    )

    # ---------------------------------------------------
    # PARSIRANJE BRAND ALIGNMENT VEKTORA
    # ---------------------------------------------------

    influencers[
        "parsed_vector"
    ] = influencers[
        "brand_alignment_vector"
    ].apply(
        lambda x: safe_json(
            x,
            {}
        )
    )

    # ---------------------------------------------------
    # PARSIRANJE ENGAGEMENT METRIKA
    # ---------------------------------------------------

    if "engagement_metrics" in influencers.columns:

        influencers[
            "parsed_engagement"
        ] = influencers[
            "engagement_metrics"
        ].apply(
            lambda x: safe_json(
                x,
                {}
            )
        )

    else:

        influencers[
            "parsed_engagement"
        ] = [
            {}
            for _ in range(
                len(influencers)
            )
        ]

    # ---------------------------------------------------
    # PARSIRANJE LATEST POSTS
    # ---------------------------------------------------

    if "latest_posts" in influencers.columns:

        influencers[
            "parsed_posts"
        ] = influencers[
            "latest_posts"
        ].apply(
            safe_json_list
        )

    else:

        influencers[
            "parsed_posts"
        ] = [
            []
            for _ in range(
                len(influencers)
            )
        ]

    # ---------------------------------------------------
    # PROVERA DA LI VEKTOR IMA SVIH 6 DIMENZIJA
    # ---------------------------------------------------

    valid_mask = influencers[
        "parsed_vector"
    ].apply(
        lambda vector: all(
            key in vector
            and pd.notna(
                vector[key]
            )
            for key in VECTOR_KEYS
        )
    )

    influencers = influencers[
        valid_mask
    ].reset_index(
        drop=True
    )

    # ---------------------------------------------------
    # KREIRANJE MATRICE INFLUENCER VEKTORA
    # ---------------------------------------------------

    matrix = np.array(
        [
            [
                float(
                    vector[key]
                )
                for key in VECTOR_KEYS
            ]
            for vector in influencers[
                "parsed_vector"
            ]
        ],
        dtype=float
    )

    return (
        influencers,
        brands,
        matrix
    )


# =======================================================
# RELOAD PODATAKA
# =======================================================

def reload_data():

    global INFLUENCERS
    global BRANDS
    global INFLUENCER_MATRIX

    (
        INFLUENCERS,
        BRANDS,
        INFLUENCER_MATRIX
    ) = load_data()


# Prvo učitavanje podataka pri pokretanju backenda.
INFLUENCERS, BRANDS, INFLUENCER_MATRIX = load_data()


# =======================================================
# FASTAPI
# =======================================================

app = FastAPI(
    title="Travel Influencer Matchmaking API",
    version="1.0.0",
    description=(
        "Content-based recommendation API "
        "for travel influencer matchmaking."
    ),
)


# =======================================================
# CORS
# =======================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://diplomski-psi.vercel.app",

    ],

    allow_origin_regex=r"https://.*\.vercel\.app",

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =======================================================
# CUSTOM BRAND REQUEST MODEL
# =======================================================

class CustomBrandRequest(BaseModel):

    name: str = Field(
        default="Custom brand",
        min_length=1,
        max_length=100
    )

    eco_conscious: float = Field(
        ge=0,
        le=1
    )

    luxury_orientation: float = Field(
        ge=0,
        le=1
    )

    budget_orientation: float = Field(
        ge=0,
        le=1
    )

    adventure_orientation: float = Field(
        ge=0,
        le=1
    )

    family_friendly: float = Field(
        ge=0,
        le=1
    )

    authenticity_signal: float = Field(
        ge=0,
        le=1
    )

    limit: int = Field(
        default=10,
        ge=1,
        le=20
    )


# =======================================================
# BRAND VECTOR
# =======================================================

def brand_vector_from_row(
    row: pd.Series
) -> dict:

    return {
        key: float(
            row[key]
        )
        for key in VECTOR_KEYS
    }


# =======================================================
# SERIALIZACIJA INFLUENSERA
# =======================================================

def serialize_influencer(
    row: pd.Series,
    rank: int,
    similarity: float
) -> dict:

    # ---------------------------------------------------
    # FOLLOWERS
    # ---------------------------------------------------

    followers = None

    if (
        "followers" in row
        and pd.notna(
            row.get(
                "followers"
            )
        )
    ):

        try:

            followers = int(
                float(
                    row.get(
                        "followers"
                    )
                )
            )

        except (
            TypeError,
            ValueError
        ):

            followers = None

    # ---------------------------------------------------
    # SENTIMENT
    # ---------------------------------------------------

    sentiment = None

    if (
        "sentiment_score" in row
        and pd.notna(
            row.get(
                "sentiment_score"
            )
        )
    ):

        try:

            sentiment = float(
                row.get(
                    "sentiment_score"
                )
            )

        except (
            TypeError,
            ValueError
        ):

            sentiment = None

    # ---------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------

    return {

        "rank":
            int(
                rank
            ),

        "influencer_handle":
            str(
                row[
                    "influencer_handle"
                ]
            ),

        "handle_normalized":
            str(
                row[
                    "handle_normalized"
                ]
            ),

        "platform":
            str(
                row.get(
                    "platform",
                    ""
                )
            ),

        "category_label":
            str(
                row.get(
                    "category_label",
                    ""
                )
            ),

        "sentiment_score":
            sentiment,

        "followers":
            followers,

        "similarity_score":
            float(
                similarity
            ),

        "engagement":
            row.get(
                "parsed_engagement",
                {}
            ),

        "vector":
            {
                key: float(
                    row[
                        "parsed_vector"
                    ][key]
                )
                for key in VECTOR_KEYS
            },

        "bio_text":
            (
                ""
                if pd.isna(
                    row.get(
                        "bio_text"
                    )
                )
                else str(
                    row.get(
                        "bio_text"
                    )
                )
            ),

        "latest_captions":
            (
                ""
                if pd.isna(
                    row.get(
                        "latest_captions"
                    )
                )
                else str(
                    row.get(
                        "latest_captions"
                    )
                )
            ),

        "latest_posts":
            row.get(
                "parsed_posts",
                []
            ),
    }


# =======================================================
# RECOMMENDATION ENGINE
# =======================================================

def recommend_from_vector(
    brand_vector: dict,
    limit: int = 10,
    platform: Optional[str] = None,
    category: Optional[str] = None,
):

    # ---------------------------------------------------
    # BRAND VECTOR -> NUMPY ARRAY
    # ---------------------------------------------------

    brand_arr = np.array(
        [
            [
                float(
                    brand_vector[key]
                )
                for key in VECTOR_KEYS
            ]
        ],
        dtype=float
    )

    # ---------------------------------------------------
    # COSINE SIMILARITY
    # ---------------------------------------------------

    similarities = cosine_similarity(
        brand_arr,
        INFLUENCER_MATRIX
    )[0]

    scored = INFLUENCERS.copy()

    scored[
        "similarity_score"
    ] = similarities

    # ---------------------------------------------------
    # FILTER PO PLATFORMI
    # ---------------------------------------------------

    if platform:

        scored = scored[
            scored[
                "platform"
            ]
            .astype(str)
            .str.lower()
            == platform.lower()
        ]

    # ---------------------------------------------------
    # FILTER PO KATEGORIJI
    # ---------------------------------------------------

    if category:

        scored = scored[
            scored[
                "category_label"
            ]
            .astype(str)
            .str.lower()
            == category.lower()
        ]

    # ---------------------------------------------------
    # SORTIRANJE I TOP N
    # ---------------------------------------------------

    scored = (
        scored
        .sort_values(
            "similarity_score",
            ascending=False
        )
        .drop_duplicates(
            subset=[
                "handle_normalized"
            ],
            keep="first"
        )
        .head(
            limit
        )
        .reset_index(
            drop=True
        )
    )

    return [
        serialize_influencer(
            row,
            idx + 1,
            row[
                "similarity_score"
            ]
        )
        for idx, (
            _,
            row
        ) in enumerate(
            scored.iterrows()
        )
    ]


# =======================================================
# HEALTH ENDPOINT
# =======================================================

@app.get(
    "/api/health"
)
def health():

    return {

        "status":
            "ok",

        "influencers":
            int(
                len(
                    INFLUENCERS
                )
            ),

        "brands":
            int(
                len(
                    BRANDS
                )
            ),
    }


# =======================================================
# RELOAD DATA ENDPOINT
# =======================================================

@app.post(
    "/api/reload-data"
)
def reload_backend_data():

    try:

        reload_data()

        return {

            "success":
                True,

            "message":
                "Podaci su ponovo učitani.",

            "influencers":
                int(
                    len(
                        INFLUENCERS
                    )
                ),

            "brands":
                int(
                    len(
                        BRANDS
                    )
                ),
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(
                e
            )
        )


# =======================================================
# BRANDS ENDPOINT
# =======================================================

@app.get(
    "/api/brands"
)
def get_brands():

    rows = []

    brands_sorted = BRANDS.copy()

    # ---------------------------------------------------
    # CUSTOM REDOSLED BRENDOVA
    # ---------------------------------------------------

    brands_sorted[
        "custom_order"
    ] = brands_sorted[
        "brand"
    ].apply(
        lambda brand:
            BRAND_ORDER.index(
                brand
            )
            if brand in BRAND_ORDER
            else len(
                BRAND_ORDER
            )
    )

    brands_sorted = (
        brands_sorted
        .sort_values(
            [
                "custom_order",
                "brand"
            ]
        )
    )

    for _, row in brands_sorted.iterrows():

        rows.append(
            {

                "brand":
                    str(
                        row[
                            "brand"
                        ]
                    ),

                "brand_type":
                    str(
                        row[
                            "brand_type"
                        ]
                    ),

                "vector":
                    brand_vector_from_row(
                        row
                    ),
            }
        )

    return {

        "brands":
            rows,

        "vector_labels":
            VECTOR_LABELS,
    }


# =======================================================
# FILTERS ENDPOINT
# =======================================================

@app.get(
    "/api/filters"
)
def get_filters():

    return {

        "platforms":
            sorted(
                INFLUENCERS[
                    "platform"
                ]
                .dropna()
                .astype(str)
                .unique()
                .tolist()
            ),

        "categories":
            sorted(
                INFLUENCERS[
                    "category_label"
                ]
                .dropna()
                .astype(str)
                .unique()
                .tolist()
            ),
    }


# =======================================================
# RECOMMENDATIONS ENDPOINT
# =======================================================

@app.get(
    "/api/recommendations"
)
def get_recommendations(

    brand: str,

    limit: int = Query(
        default=10,
        ge=1,
        le=20
    ),

    platform: Optional[str] = None,

    category: Optional[str] = None,
):

    # ---------------------------------------------------
    # PRONALAZAK BRENDA
    # ---------------------------------------------------

    match = BRANDS[
        BRANDS[
            "brand"
        ]
        .astype(str)
        .str.lower()
        == brand.lower()
    ]

    if match.empty:

        raise HTTPException(
            status_code=404,
            detail=(
                "Brand nije pronađen."
            )
        )

    row = match.iloc[
        0
    ]

    vector = brand_vector_from_row(
        row
    )

    # ---------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------

    return {

        "brand":
            str(
                row[
                    "brand"
                ]
            ),

        "brand_type":
            str(
                row[
                    "brand_type"
                ]
            ),

        "brand_vector":
            vector,

        "recommendations":
            recommend_from_vector(
                vector,
                limit,
                platform,
                category
            ),
    }


# =======================================================
# CUSTOM BRAND RECOMMENDATIONS
# =======================================================

@app.post(
    "/api/custom-recommendations"
)
def custom_recommendations(
    payload: CustomBrandRequest
):

    vector = {
        key: float(
            getattr(
                payload,
                key
            )
        )
        for key in VECTOR_KEYS
    }

    return {

        "brand":
            payload.name,

        "brand_type":
            "custom",

        "brand_vector":
            vector,

        "recommendations":
            recommend_from_vector(
                vector,
                payload.limit
            ),
    }


# =======================================================
# VALIDATION
# =======================================================

def validation_metrics():

    # Ako validation_set.csv ne postoji,
    # validation endpoint neće biti dostupan.
    if not VALIDATION_CSV.exists():

        return None

    validation = pd.read_csv(
        VALIDATION_CSV
    )

    rows = []

    # ---------------------------------------------------
    # PROLAZAK KROZ VALIDATION PAROVE
    # ---------------------------------------------------

    for _, item in validation.iterrows():

        brand = str(
            item[
                "brand"
            ]
        )

        handle = normalize_handle(
            item[
                "influencer_handle"
            ]
        )

        evidence_type = str(
            item.get(
                "evidence_type",
                "unknown"
            )
        )

        # ------------------------------------------------
        # PRONALAŽENJE BRAND VEKTORA
        # ------------------------------------------------

        brand_match = BRANDS[
            BRANDS[
                "brand"
            ]
            .astype(str)
            .str.lower()
            == brand.lower()
        ]

        if brand_match.empty:

            rank = None
            hit = 0
            rr = 0.0

        else:

            vector = brand_vector_from_row(
                brand_match.iloc[
                    0
                ]
            )

            # Validation koristi Top 10.
            recommendations = (
                recommend_from_vector(
                    vector,
                    limit=10
                )
            )

            found = next(
                (
                    result
                    for result
                    in recommendations
                    if normalize_handle(
                        result[
                            "influencer_handle"
                        ]
                    )
                    == handle
                ),
                None
            )

            rank = (
                found[
                    "rank"
                ]
                if found
                else None
            )

            hit = (
                1
                if found
                else 0
            )

            rr = (
                1 / rank
                if rank
                else 0.0
            )

        rows.append(
            {

                "brand":
                    brand,

                "influencer_handle":
                    str(
                        item[
                            "influencer_handle"
                        ]
                    ),

                "evidence_type":
                    evidence_type,

                "predicted_rank":
                    rank,

                "hit_at_10":
                    hit,

                "reciprocal_rank":
                    rr,
            }
        )

    result = pd.DataFrame(
        rows
    )

    # ---------------------------------------------------
    # IZRAČUN METRIKA
    # ---------------------------------------------------

    def metric_block(
        df
    ):

        if df.empty:

            return {

                "examples":
                    0,

                "hit_at_10":
                    0.0,

                "mrr":
                    0.0,
            }

        return {

            "examples":
                int(
                    len(
                        df
                    )
                ),

            "hit_at_10":
                float(
                    df[
                        "hit_at_10"
                    ].mean()
                ),

            "mrr":
                float(
                    df[
                        "reciprocal_rank"
                    ].mean()
                ),
        }

    # ---------------------------------------------------
    # FINALNI VALIDATION RESPONSE
    # ---------------------------------------------------

    return {

        "confirmed":
            metric_block(
                result[
                    result[
                        "evidence_type"
                    ]
                    == "confirmed_collaboration"
                ]
            ),

        "mentions":
            metric_block(
                result[
                    result[
                        "evidence_type"
                    ]
                    == "mention_only"
                ]
            ),

        "overall":
            metric_block(
                result
            ),

        "details":
            rows,
    }


# =======================================================
# VALIDATION ENDPOINT
# =======================================================

@app.get(
    "/api/validation"
)
def get_validation():

    result = validation_metrics()

    if result is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Validation set nije pronađen."
            )
        )

    return result