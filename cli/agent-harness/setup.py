from setuptools import setup

setup(
    name="ruflo-cli",
    version="1.0.0",
    description="EMPX-Cross-Chain cross-chain swap protocol — CLI agent harness",
    py_modules=["ruflo_cli"],
    install_requires=[
        "click>=8.0",
    ],
    entry_points={
        "console_scripts": [
            "ruflo=ruflo_cli:cli",
        ],
    },
    python_requires=">=3.8",
)
