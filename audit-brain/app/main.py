from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import router as audit_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="低代码组件异常行为AI智能审计系统 - 审计大脑服务",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audit_router)


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "endpoints": [
            "/api/v1/health",
            "/api/v1/audit",
            "/api/v1/audit/batch",
            "/api/v1/audit/static",
            "/api/v1/audit/llm",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
