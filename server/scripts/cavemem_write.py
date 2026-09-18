#!/usr/bin/env python3
"""
cavemem_write.py - Quick write wrapper for Strategic Memory
Usage:
  python cavemem_write.py adr --project X --title Y --summary Z --rationale R [--tags T]
  python cavemem_write.py grill --project X --topic T --questions Q --answers A --key-takeaways K --resolved-direction D
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cavemem_strategic import StrategicMemoryDB


def cmd_adr(args):
    db = StrategicMemoryDB()
    record_id = db.insert_adr(
        project=args.project,
        title=args.title,
        context=args.summary,
        decision=args.title,
        rationale=args.rationale,
        trade_offs=getattr(args, 'trade_offs', ''),
        status='accepted',
        tags=getattr(args, 'tags', ''),
    )
    print(f"ADR #{record_id} saved: {args.title} [{args.project}]")


def cmd_grill(args):
    db = StrategicMemoryDB()
    record_id = db.insert_grill_me_log(
        project=args.project,
        topic=args.topic,
        questions=args.questions,
        answers=args.answers,
        key_takeaways=args.key_takeaways,
        resolved_direction=args.resolved_direction,
    )
    print(f"Grill-Me Log #{record_id} saved: {args.topic} [{args.project}]")


def main():
    parser = argparse.ArgumentParser(description='Write to Strategic Memory')
    subparsers = parser.add_subparsers(dest='command')

    adr_p = subparsers.add_parser('adr', help='Record an Architectural Decision')
    adr_p.add_argument('--project', required=True)
    adr_p.add_argument('--title', required=True)
    adr_p.add_argument('--summary', required=True)
    adr_p.add_argument('--rationale', required=True)
    adr_p.add_argument('--trade-offs', default='')
    adr_p.add_argument('--tags', default='')

    grill_p = subparsers.add_parser('grill', help='Record a Grill-Me session')
    grill_p.add_argument('--project', required=True)
    grill_p.add_argument('--topic', required=True)
    grill_p.add_argument('--questions', required=True)
    grill_p.add_argument('--answers', required=True)
    grill_p.add_argument('--key-takeaways', required=True)
    grill_p.add_argument('--resolved-direction', required=True)

    args = parser.parse_args()
    if args.command == 'adr':
        cmd_adr(args)
    elif args.command == 'grill':
        cmd_grill(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
