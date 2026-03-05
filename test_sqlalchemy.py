try:
    import sqlalchemy
    print(f"SQLAlchemy version: {sqlalchemy.__version__}")
    from sqlalchemy import select, func, Table, Column, Integer, MetaData
    metadata = MetaData()
    table = Table("test", metadata, Column("id", Integer, primary_key=True))

    # Test new style select (SQLAlchemy 1.4/2.0)
    try:
        query_new = select(func.max(table.c.id))
        print("New style select worked")
    except Exception as e:
        print(f"New style select failed: {e}")

    # Test old style select (SQLAlchemy 1.3)
    try:
        query_old = select([func.max(table.c.id)])
        print("Old style select worked")
    except Exception as e:
        print(f"Old style select failed: {e}")
except ImportError:
    print("SQLAlchemy not installed")
