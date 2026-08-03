"""后端通用辅助函数。"""


def build_iri(namespace: str, name: str) -> str:
    """在命名空间下构建实体 IRI。"""
    ns = namespace if namespace.endswith(("#", "/")) else f"{namespace}#"
    return f"{ns}{name}"
