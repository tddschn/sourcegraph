package database

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/graph-gophers/graphql-go"
	"github.com/graph-gophers/graphql-go/relay"
	"github.com/keegancsmith/sqlf"

	"github.com/sourcegraph/sourcegraph/lib/errors"
)

// LimitOffset specifies SQL LIMIT and OFFSET counts. A pointer to it is typically embedded in other options
// structs that need to perform SQL queries with LIMIT and OFFSET.
type LimitOffset struct {
	Limit  int // SQL LIMIT count
	Offset int // SQL OFFSET count
}

// SQL returns the SQL query fragment ("LIMIT %d OFFSET %d") for use in SQL queries.
func (o *LimitOffset) SQL() *sqlf.Query {
	if o == nil {
		return &sqlf.Query{}
	}
	return sqlf.Sprintf("LIMIT %d OFFSET %d", o.Limit, o.Offset)
}

// maybeQueryIsID returns a possible database ID if query looks like either a
// database ID or a graphql.ID.
func maybeQueryIsID(query string) (int32, bool) {
	// Query looks like an ID
	if id, err := strconv.ParseInt(query, 10, 32); err == nil {
		return int32(id), true
	}

	// Query looks like a GraphQL ID
	var id int32
	err := relay.UnmarshalSpec(graphql.ID(query), &id)
	return id, err == nil
}

type QueryArgs struct {
	Where *sqlf.Query
	Order *sqlf.Query
	Limit *sqlf.Query
}

func (a *QueryArgs) AppendWhereToQuery(query *sqlf.Query) *sqlf.Query {
	if a.Where == nil {
		return query
	}

	return sqlf.Sprintf("%v WHERE %v", query, a.Where)
}

func (a *QueryArgs) AppendOrderToQuery(query *sqlf.Query) *sqlf.Query {
	if a.Order == nil {
		return query
	}

	return sqlf.Sprintf("%v ORDER BY %v", query, a.Order)
}

func (a *QueryArgs) AppendLimitToQuery(query *sqlf.Query) *sqlf.Query {
	if a.Limit == nil {
		return query
	}

	return sqlf.Sprintf("%v %v", query, a.Limit)
}

func (a *QueryArgs) AppendAllToQuery(query *sqlf.Query) *sqlf.Query {
	query = a.AppendWhereToQuery(query)
	query = a.AppendOrderToQuery(query)
	query = a.AppendLimitToQuery(query)

	return query
}

type OrderBy []OrderByOption

func (o OrderBy) Columns() []string {
	columns := []string{}

	for _, orderOption := range o {
		columns = append(columns, orderOption.Field)
	}

	return columns
}

func (o OrderBy) SQL(descending bool) *sqlf.Query {
	columns := []*sqlf.Query{}

	for _, orderOption := range o {
		columns = append(columns, orderOption.SQL(descending))
	}

	return sqlf.Join(columns, ", ")
}

type OrderByOption struct {
	Field string
	Nulls string
}

func (o OrderByOption) SQL(descending bool) *sqlf.Query {
	var sb strings.Builder

	sb.WriteString(string(o.Field))

	if descending {
		sb.WriteString(" DESC")
	} else {
		sb.WriteString(" ASC")
	}

	if o.Nulls == "FIRST" || o.Nulls == "LAST" {
		sb.WriteString(" NULLS " + o.Nulls)
	}

	return sqlf.Sprintf(sb.String())
}

type PaginationArgs struct {
	First      *int
	Last       *int
	After      *string
	Before     *string
	OrderBy    OrderBy
	Descending bool
}

func (p *PaginationArgs) SQL() (*QueryArgs, error) {
	queryArgs := &QueryArgs{}

	var conditions []*sqlf.Query

	orderByColumns := p.OrderBy.Columns()
	if len(orderByColumns) < 1 {
		return nil, errors.New("Atleast 1 sort column must be provided")
	}

	if p.After != nil {
		columnsStr := strings.Join(orderByColumns, ", ")
		condition := fmt.Sprintf("(%s) >", columnsStr)
		if p.Descending {
			condition = fmt.Sprintf("(%s) <", columnsStr)
		}

		conditions = append(conditions, sqlf.Sprintf(fmt.Sprintf(condition+" (%s)", *p.After)))
	}
	if p.Before != nil {
		columnsStr := strings.Join(orderByColumns, ", ")
		condition := fmt.Sprintf("(%s) <", columnsStr)
		if p.Descending {
			condition = fmt.Sprintf("(%s) >", columnsStr)
		}

		conditions = append(conditions, sqlf.Sprintf(fmt.Sprintf(condition+" (%s)", *p.Before)))
	}

	if len(conditions) > 0 {
		queryArgs.Where = sqlf.Sprintf("%v", sqlf.Join(conditions, "AND "))
	}

	if p.First != nil {
		queryArgs.Order = p.OrderBy.SQL(p.Descending)
		queryArgs.Limit = sqlf.Sprintf("LIMIT %d", *p.First)
	} else if p.Last != nil {
		queryArgs.Order = p.OrderBy.SQL(!p.Descending)
		queryArgs.Limit = sqlf.Sprintf("LIMIT %d", *p.Last)
	} else {
		return nil, errors.New("First or Last must be set")
	}

	return queryArgs, nil
}

// Clone (aka deepcopy) returns a new PaginationArgs object with the same values as "p".
func (p *PaginationArgs) Clone() *PaginationArgs {
	copyIntPtr := func(n *int) *int {
		if n == nil {
			return nil
		}

		c := *n
		return &c
	}
	return &PaginationArgs{
		First:  copyIntPtr(p.First),
		Last:   copyIntPtr(p.Last),
		After:  copyIntPtr(p.After),
		Before: copyIntPtr(p.Before),
	}
}
